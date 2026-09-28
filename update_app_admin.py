import re
with open('backend/src/app.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("await app.register(adminRoutes, { prefix: '/api/v1/admin', database })", "await app.register(adminRoutes, { prefix: '/api/v1/admin', database: kyselyDb as any, eventHub })")

with open('backend/src/app.ts', 'w', encoding='utf-8') as f:
    f.write(c)
