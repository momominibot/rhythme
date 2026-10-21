#!/usr/bin/env python3
"""Guarded art run: the jobs in a JSON file, one at a time, through gen.py with no retries; stop on the first failure.

Usage: run_batch.py jobs.json OUTDIR [--only id,id] [--dry]

- one run at a time: OUTDIR/.lock is made at the start and removed at the end; an existing lock refuses to start;
- a job whose output already exists and opens as an image is skipped, so a stopped run resumes where it stopped and
  nothing that rendered is ever paid for twice;
- each job runs `gen.py --retries 0 --url`; success is gen.py's exit code 0 AND an output file that PIL opens at the size
  asked for (judged by gen.py's exit code and the file, never by grepping its output, which once matched "403" inside a
  path); anything else stops the run with the job's id, and nothing after it is attempted;
- every start, finish and stop is appended to OUTDIR/run.log. The key is gen.py's business (ARK_API_KEY or the file).
No keying, no WebP: those are done by hand after looking at each picture (keyout.py, cwebp)."""
import argparse, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))


def opens(path, size):
    try:
        from PIL import Image
        with Image.open(path) as im:
            im.load()
            if size and "x" in size:
                w, h = (int(n) for n in size.split("x"))
                return im.size == (w, h), im.size
            return True, im.size
    except Exception as e:
        return False, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs"); ap.add_argument("outdir")
    ap.add_argument("--only", default=""); ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    jobs = json.load(open(a.jobs, encoding="utf-8"))["jobs"]
    if a.only:
        keep = set(a.only.split(",")); jobs = [j for j in jobs if j["id"] in keep]
    os.makedirs(a.outdir, exist_ok=True)
    lock, logp = os.path.join(a.outdir, ".lock"), os.path.join(a.outdir, "run.log")

    def log(msg):
        line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
        print(line); open(logp, "a", encoding="utf-8").write(line + "\n")

    if os.path.exists(lock):
        print("another run holds " + lock + "; not starting", file=sys.stderr); sys.exit(9)
    open(lock, "w").write(str(os.getpid()))
    try:
        log("start: %d jobs from %s" % (len(jobs), os.path.basename(a.jobs)))
        for j in jobs:
            out = os.path.join(a.outdir, j["out"])
            if os.path.exists(out) and opens(out, j.get("size"))[0]:
                log("skip %s: already rendered" % j["id"]); continue
            cmd = [sys.executable, os.path.join(HERE, "gen.py"), "--retries", "0", "--url", "--out", out, "--size", j["size"], "--seed", str(j.get("seed", -1))]
            for r in j.get("ref", []):
                cmd += ["--ref", r]
            if j.get("model"):
                cmd += ["--model", j["model"]]
            cmd.append(j["prompt"])
            if a.dry:
                log("dry %s: %s %s seed %s" % (j["id"], j["out"], j["size"], j.get("seed"))); continue
            log("job %s: %s %s seed %s" % (j["id"], j["out"], j["size"], j.get("seed")))
            t0 = time.time(); p = subprocess.run(cmd, capture_output=True, text=True)
            ok, got = opens(out, j.get("size")) if p.returncode == 0 and os.path.exists(out) else (False, None)
            if not ok:
                log("STOP at %s: exit %s, image %s, after %.1f s. stderr: %s" % (j["id"], p.returncode, got, time.time() - t0, (p.stderr or "").strip()[-400:]))
                sys.exit(1)
            log("done %s: %s in %.1f s" % (j["id"], got, time.time() - t0))
        log("finished")
    finally:
        os.remove(lock)


if __name__ == "__main__":
    main()
