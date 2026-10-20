#!/usr/bin/env python3
"""Self-cancelling dry runs for Supabase migrations.
  python3 tools/db/dryrun.py MIGRATION DRYRUN          print one batch for execute_sql: the migration, then the dry run,
                                                     which ends by raising 'RESULT {...}' so the whole implicit transaction
                                                     rolls back and nothing is kept
  python3 tools/db/dryrun.py --bodies MIGRATION        print md5 of every function body in the migration, to compare with
                                                     the 'bodies' the dry run reports (proves the batch sent was the file)"""
import sys, re, hashlib, json
if sys.argv[1] == '--bodies':
    text = open(sys.argv[2], encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"create or replace function (\w+)\.(\w+)\([^$]*?\$\$(.*?)\$\$", text, re.S):
        out[m.group(1) + '.' + m.group(2)] = hashlib.md5(m.group(3).encode('utf-8')).hexdigest()
    print(json.dumps(out, indent=1, sort_keys=True))
else:
    mig = open(sys.argv[1], encoding='utf-8').read()
    mig = mig.rsplit('\n-- Undo:\n', 1)[0]  # the undo notes at the end are comments; leave them out of the batch
    print(mig.rstrip() + '\n\n' + open(sys.argv[2], encoding='utf-8').read())
