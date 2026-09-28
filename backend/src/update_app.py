import re

with open("app.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Add Kysely import
if "createKyselyInstance" not in content:
    content = content.replace("import { createDatabase, type Database } from './db.js'",
                              "import { createDatabase, type Database } from './db.js'\nimport { createKyselyInstance } from './db/kysely.js'")

# Find app.register(fieldReportRoutes...)
old_register = "await app.register(fieldReportRoutes, { prefix: '/api/v1/maintenance/field-reports', database, eventHub })"
new_register = '''const kyselyDb = createKyselyInstance(database as any);
  await app.register(fieldReportRoutes, { prefix: '/api/v1/maintenance/field-reports', database: kyselyDb as any, eventHub })'''
content = content.replace(old_register, new_register)

with open("app.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated app.ts")
