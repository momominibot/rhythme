# Blender: render Rhea from a Meshy animation GLB into transparent sprite frames, at the angle of her 2D pictures.
# blender -b -P render.py -- <in.glb> <out_dir> <frames> [yaw_degrees] [height_px]
import bpy, sys, os, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, out, frames = argv[0], argv[1], int(argv[2]); yaw = float(argv[3]) if len(argv) > 3 else -22.0; H = int(argv[4]) if len(argv) > 4 else 720
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in [o for o in meshes if o.name.lower().startswith('icosphere')]:   # Meshy's rigged files carry a hidden helper sphere
    o.hide_render = True; meshes.remove(o)
root = arm or meshes[0]
root.rotation_mode = 'XYZ'; root.rotation_euler[2] += math.radians(yaw)   # turn her a little to the viewer's left, like her pictures
# her puffy sleeves tear with the rig's own weights: optionally re-weight in Blender (bone heat), smooth the weights, and
# add Corrective Smooth so stretched parts even out (the usual fix for loose clothing, Blender Artists / weight guides)
if arm and os.environ.get('REWEIGHT') == '1':
    for m in meshes:
        for md in list(m.modifiers):
            if md.type == 'ARMATURE': m.modifiers.remove(md)
        m.vertex_groups.clear()
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes: m.select_set(True)
    arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for m in meshes:
        bpy.context.view_layer.objects.active = m; bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
        try: bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.6, repeat=4)
        except Exception as e: print('smooth skipped', e)
        bpy.ops.object.mode_set(mode='OBJECT')
if arm and os.environ.get('SMOOTHW') == '1':   # soften the seam where sleeve meets hand: smooth only the arm bones' weights
    for m in meshes:
        bpy.context.view_layer.objects.active = m; bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
        for gname in ('LeftHand', 'RightHand', 'LeftForeArm', 'RightForeArm', 'LeftArm', 'RightArm'):
            g = m.vertex_groups.get(gname)
            if not g: continue
            m.vertex_groups.active_index = g.index
            try: bpy.ops.object.vertex_group_smooth(group_select_mode='ACTIVE', factor=0.5, repeat=int(os.environ.get('SMOOTH_N', '8')), expand=0.2)
            except Exception as e: print('smooth', gname, e)
        try: bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        except Exception as e: print('normalize', e)
        bpy.ops.object.mode_set(mode='OBJECT')
if os.environ.get('CSMOOTH') == '1':
    for m in meshes:
        cs = m.modifiers.new('csmooth', 'CORRECTIVE_SMOOTH'); cs.iterations = 12; cs.smooth_type = 'LENGTH_WEIGHTED'; cs.rest_source = 'ORCO'
# a hand-set pose (POSE=carry): elbows bent forward, hands drawn in front of her waist, the gentlest arm move her big
# sleeves allow. Rotations are about each bone's head, in armature space, so they read the same whatever the rig's rolls.
SH = float(os.environ.get('SHOULDER', '-12'))
POSES = {'carry': {'LeftArm': ('Y', SH), 'RightArm': ('Y', -SH), 'LeftForeArm': ('X', float(os.environ.get('ELBOW', '-70'))), 'RightForeArm': ('X', float(os.environ.get('ELBOW', '-70'))),
                   'LeftHand': ('Z', float(os.environ.get('WRIST', '0'))), 'RightHand': ('Z', -float(os.environ.get('WRIST', '0')))}}   # wrists unrotated: turning them tore the cuffs
pose = POSES.get(os.environ.get('POSE', ''))
if pose and arm:
    if arm.animation_data: arm.animation_data.action = None
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
    for name in ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']:   # parents first
        if name not in pose or name not in arm.pose.bones: continue
        pb = arm.pose.bones[name]; axis, deg = pose[name]
        R = mathutils.Matrix.Rotation(math.radians(deg), 4, axis)
        head = pb.matrix.to_translation()
        pb.matrix = mathutils.Matrix.Translation(head) @ R @ mathutils.Matrix.Translation(-head) @ pb.matrix
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
# a prop in her two hands (PROP=basket.glb): sized to the gap between her hands and set so her hands hold its sides
if os.environ.get('PROP') and arm:
    before = set(sc.objects)
    bpy.ops.import_scene.gltf(filepath=os.environ['PROP'])
    prop = [o for o in sc.objects if o not in before]
    pm = [o for o in prop if o.type == 'MESH']
    bpy.context.view_layer.update()
    aw = arm.matrix_world
    def handpos(name):   # the posed mesh's own hand: vertices weighted to that bone, in world space
        dg = bpy.context.evaluated_depsgraph_get(); acc = mathutils.Vector((0, 0, 0)); n = 0
        for m in [o for o in meshes if o.type == 'MESH']:
            g = m.vertex_groups.get(name)
            if not g: continue
            me = m.evaluated_get(dg); mw = me.matrix_world; src = m.data
            for v in src.vertices:
                for ge in v.groups:
                    if ge.group == g.index and ge.weight > 0.6:
                        acc += mw @ me.data.vertices[v.index].co; n += 1
        return acc / max(n, 1)
    lh = handpos('LeftHand'); rh = handpos('RightHand')
    mid = (lh + rh) / 2; gap = (lh - rh).length
    lo2 = mathutils.Vector((1e9, 1e9, 1e9)); hi2 = -lo2
    for o in pm:
        for c in o.bound_box:
            p = o.matrix_world @ mathutils.Vector(c); lo2 = mathutils.Vector(map(min, lo2, p)); hi2 = mathutils.Vector(map(max, hi2, p))
    width = max(hi2.x - lo2.x, hi2.y - lo2.y); k = gap * float(os.environ.get('PROP_SCALE', '1.15')) / width
    print('PROPDBG gap', round(gap, 4), 'width', round(width, 4), 'k', round(k, 4), 'lh', tuple(round(v, 3) for v in lh), 'rh', tuple(round(v, 3) for v in rh), 'arm scale', tuple(arm.scale), 'roots', [(o.name, o.type, tuple(o.scale)) for o in prop if o.parent is None])
    rootp = next((o for o in prop if o.parent is None), pm[0])
    rootp.scale = rootp.scale * k; bpy.context.view_layer.update()
    lo2 = mathutils.Vector((1e9, 1e9, 1e9)); hi2 = -lo2
    for o in pm:
        for c in o.bound_box:
            p = o.matrix_world @ mathutils.Vector(c); lo2 = mathutils.Vector(map(min, lo2, p)); hi2 = mathutils.Vector(map(max, hi2, p))
    c2 = (lo2 + hi2) / 2; bh = hi2.z - lo2.z
    # her hands at the basket's lower sides, the basket a little in front of her
    rootp.location += mathutils.Vector((mid.x - c2.x, mid.y - c2.y - gap * float(os.environ.get('PROP_FWD', '0.05')), mid.z - (lo2.z + bh * float(os.environ.get('PROP_GRIP', '0.62')))))   # her hands on the walls near the rim
    prop_meshes = pm   # kept out of the camera bounds: she is framed, the basket rides along
    for o in pm:
        for slot in o.material_slots:
            if slot.material and hasattr(slot.material, 'blend_method'): slot.material.blend_method = 'OPAQUE'
# ACTION_FROM=<move.glb>: play that file's move on this (repaired) model; bone names are the same Meshy skeleton
if os.environ.get('ACTION_FROM') and arm:
    before = set(sc.objects); bpy.ops.import_scene.gltf(filepath=os.environ['ACTION_FROM'])
    new = [o for o in sc.objects if o not in before]; arm2 = next((o for o in new if o.type == 'ARMATURE'), None)
    if arm2 and arm2.animation_data and arm2.animation_data.action:
        if not arm.animation_data: arm.animation_data_create()
        arm.animation_data.action = arm2.animation_data.action
        try: arm.animation_data.action_slot = arm.animation_data.action.slots[0]
        except Exception: pass
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
# HOLD_ARMS=1: her arms keep the pose they were made in (holding the basket) while the move walks her legs and body
if os.environ.get('HOLD_ARMS') == '1' and arm and arm.animation_data and arm.animation_data.action:
    a0 = arm.animation_data.action
    keep_out = ('Shoulder', 'Arm', 'ForeArm', 'Hand')
    curves = []
    try: curves = list(a0.fcurves)
    except Exception:
        for layer in getattr(a0, 'layers', []):
            for strip in layer.strips:
                for cb in strip.channelbags: curves += list(cb.fcurves)
    removed = 0
    for fc in curves:
        dp = fc.data_path
        if 'pose.bones["' in dp:
            bone = dp.split('pose.bones["')[1].split('"]')[0]
            if any(bone.endswith(k) for k in keep_out) and ('Left' in bone or 'Right' in bone):
                fc.mute = True; removed += 1
    for pb in arm.pose.bones:
        if any(pb.name.endswith(k) for k in keep_out) and ('Left' in pb.name or 'Right' in pb.name):
            pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
    print('arms held, muted curves', removed)
# the action's frame range
act = arm.animation_data.action if arm and arm.animation_data and arm.animation_data.action else None
f0, f1 = (int(act.frame_range[0]), int(act.frame_range[1])) if act else (1, 1)
sc.frame_set(f0); bpy.context.view_layer.update()
# bounds over the whole action so the camera never crops a step
lo = mathutils.Vector((1e9, 1e9, 1e9)); hi = -lo
for f in range(f0, f1 + 1, max(1, (f1 - f0) // 12 or 1)):
    sc.frame_set(f); bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    for m in meshes:
        me = m.evaluated_get(dg); mw = me.matrix_world
        for v in me.data.vertices:
            p = mw @ v.co; lo = mathutils.Vector(map(min, lo, p)); hi = mathutils.Vector(map(max, hi, p))
height = hi.z - lo.z; cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
width_x = max(hi.x - lo.x, hi.y - lo.y)   # a lying or wide pose (sleeping) gets a wider frame
aspect = max(0.62, min(2.2, width_x / max(height, 1e-6) * 1.05))
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = max(height, width_x / aspect) * 1.08 * max(1.0, aspect)
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
tilt = math.radians(8)   # a little from above, as in her pictures
dist = 10
cam.location = (cx, cy - dist * math.cos(tilt), lo.z + height * 0.5 + dist * math.sin(tilt))
cam.rotation_euler = (math.radians(90) - tilt, 0, 0)
# soft clay light: a warm key from the upper left front, a cool fill, a rim from behind
def light(name, kind, energy, rot, color):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if kind == 'SUN':
        try: d.angle = math.radians(12)   # a soft-edged shadow
        except Exception: pass
    if kind == 'AREA': d.size = 6
    o = bpy.data.objects.new(name, d); o.rotation_euler = tuple(math.radians(a) for a in rot); sc.collection.objects.link(o)
    o.location = (cx + 4 * math.sin(math.radians(rot[2])), cy - 6, lo.z + height * 1.4); return o
light('key', 'SUN', float(os.environ.get('KEY', '3.0')), (40, 0, -30), (1.0, 0.98, 0.95))
light('fill', 'SUN', 0.5, (75, 0, 50), (0.95, 0.96, 1.0))
light('front', 'SUN', float(os.environ.get('FRONT', '0')), (80, 0, -10), (1.0, 0.97, 0.96))   # a soft front light: her face evenly bright, as painted
# the texture already carries the soft light of her painted picture: show it as it is (emission), so colours match
for m in meshes:   # solid, never see-through: the texture's alpha is not transparency
    for slot in m.material_slots:
        mat = slot.material
        if not mat: continue
        if hasattr(mat, 'blend_method'): mat.blend_method = 'OPAQUE'
        if hasattr(mat, 'surface_render_method'): mat.surface_render_method = 'DITHERED'
        b = mat.node_tree and next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b:
            for l in list(b.inputs['Alpha'].links): mat.node_tree.links.remove(l)
            b.inputs['Alpha'].default_value = 1.0
ns = float(os.environ.get('NSTR', '1'))   # strength of the detail (normal) map: the knit and the folds
if ns != 1:
    for m in meshes:
        for slot in m.material_slots:
            mat = slot.material
            if mat and mat.node_tree:
                for n in mat.node_tree.nodes:
                    if n.type == 'NORMAL_MAP': n.inputs['Strength'].default_value = ns
if os.environ.get('UNLIT', '0') == '1':
    for m in meshes:
        for slot in m.material_slots:
            mat = slot.material
            if not mat or not mat.use_nodes: continue
            nt = mat.node_tree; bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None); outn = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
            if not bsdf or not outn: continue
            link = bsdf.inputs['Base Color'].links[0].from_socket if bsdf.inputs['Base Color'].links else None
            em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
            if link: nt.links.new(link, em.inputs['Color'])
            else: em.inputs['Color'].default_value = bsdf.inputs['Base Color'].default_value
            nt.links.new(em.outputs['Emission'], outn.inputs['Surface'])
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = tuple(float(x) for x in os.environ.get('AMBCOL', '1,1,1').split(',')) + (1,); bg.inputs[1].default_value = float(os.environ.get('AMB', '0.45'))   # an even studio light, like Meshy's viewer
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
if os.environ.get('RENDERER') == 'cycles':   # clay glow: light passes a little into the surface; coloured shadows
    sc.render.engine = 'CYCLES'; sc.cycles.samples = int(os.environ.get('SAMPLES', '96')); sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('gpu skipped', e)
    for m in meshes:
        for slot in m.material_slots:
            mat = slot.material; b = mat and mat.node_tree and next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if not b: continue
            for k, v in (('Subsurface Weight', float(os.environ.get('SSS', '0.25'))), ('Subsurface Scale', 0.02), ('Roughness', 0.5), ('Specular IOR Level', 0.35), ('Coat Weight', float(os.environ.get('COAT', '0.15'))), ('Coat Roughness', 0.35)):
                if k in b.inputs:
                    for l in list(b.inputs[k].links): mat.node_tree.links.remove(l)
                    b.inputs[k].default_value = v
            if 'Subsurface Radius' in b.inputs: b.inputs['Subsurface Radius'].default_value = (1.0, 0.45, 0.35)
sc.render.film_transparent = True
# depth like her painted pictures: soft shadows and shadowing in the creases
for attr, val in (('use_gtao', True), ('gtao_distance', 0.3), ('use_raytracing', True), ('use_shadows', True), ('use_soft_shadows', True)):
    try: setattr(sc.eevee, attr, val)
    except Exception: pass
sc.view_settings.view_transform = 'Standard'
sc.view_settings.exposure = float(os.environ.get('EXPOSURE', '0'))
sc.render.resolution_y = H; sc.render.resolution_x = int(H * aspect); sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
picks = [f0] if frames <= 1 else [round(f0 + (f1 - f0) * i / frames) for i in range(frames)]
for i, f in enumerate(picks):
    sc.frame_set(f); sc.render.filepath = os.path.join(out, 'f%02d.png' % i); bpy.ops.render.render(write_still=True)
print('RENDERED', len(picks), 'frames of', f0, f1, 'height', round(height, 3))
