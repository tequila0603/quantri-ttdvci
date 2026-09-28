import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AppConfig } from './config.js'
import type { Database } from './db.js'
import { ApiError } from './errors.js'

export const SESSION_COOKIE = 'center_session'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  roleCode: 'DIRECTOR' | 'DATA_ADMIN'
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
  }
}

type UserRow = {
  id: string
  username: string
  display_name: string
  role_code: 'DIRECTOR' | 'DATA_ADMIN'
  password_hash: string | null
}

type SessionRow = Omit<UserRow, 'password_hash'>

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-login-password', 12)

export function authenticate(database: Database) {
  return async (request: FastifyRequest): Promise<void> => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) {
      throw new ApiError(401, 'unauthenticated', 'Vui lòng đăng nhập')
    }

    const result = await database.query<SessionRow>(
      `SELECT ua.id::text, ua.username, ua.display_name, ua.role_code
       FROM auth.sessions s
       JOIN auth.user_accounts ua ON ua.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > now()
         AND ua.is_active = true`,
      [tokenHash(token)],
    )
    const row = result.rows[0]
    if (!row) {
      throw new ApiError(401, 'unauthenticated', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
    }

    request.user = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      roleCode: row.role_code,
    }
  }
}

export function requireRole(...roles: AuthUser['roleCode'][]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user || !roles.includes(request.user.roleCode)) {
      throw new ApiError(403, 'forbidden', 'Bạn không có quyền thực hiện thao tác này')
    }
  }
}

export async function login(
  database: Database,
  config: AppConfig,
  username: string,
  password: string,
  reply: FastifyReply,
): Promise<AuthUser> {
  const result = await database.query<UserRow>(
    `SELECT id::text, username, display_name, role_code, password_hash
     FROM auth.user_accounts
     WHERE username = $1 AND is_active = true`,
    [username],
  )
  const row = result.rows[0]
  const matches = await bcrypt.compare(password, row?.password_hash ?? DUMMY_PASSWORD_HASH)
  if (!row || !row.password_hash || !matches) {
    throw new ApiError(401, 'invalid_credentials', 'Tên đăng nhập hoặc mật khẩu không đúng')
  }

  const rawToken = randomBytes(32).toString('hex')
  await database.query(
    `INSERT INTO auth.sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [row.id, tokenHash(rawToken), config.sessionTtlSeconds],
  )
  reply.setCookie(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlSeconds,
  })

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    roleCode: row.role_code,
  }
}

export async function logout(database: Database, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE]
  if (token) {
    await database.query('DELETE FROM auth.sessions WHERE token_hash = $1', [tokenHash(token)])
  }
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
}
