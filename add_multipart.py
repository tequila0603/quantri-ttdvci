import re
with open('backend/src/app.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = "import multipart from '@fastify/multipart'\n" + c
c = c.replace("await app.register(cookie)", "await app.register(cookie)\n  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })")

with open('backend/src/app.ts', 'w', encoding='utf-8') as f:
    f.write(c)
