import type { FastifyError, FastifyInstance } from 'fastify'

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      })
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Dữ liệu yêu cầu không hợp lệ',
          details: error.validation.map((item) => ({
            field: item.instancePath || item.params.missingProperty || item.params.additionalProperty || 'request',
            message: item.message ?? 'Giá trị không hợp lệ',
          })),
        },
      })
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code || 'bad_request',
          message: error.message,
        },
      })
    }

    request.log.error({ err: error }, 'Unhandled API error')
    return reply.status(500).send({
      success: false,
      error: {
        code: 'internal_error',
        message: 'Đã xảy ra lỗi máy chủ',
      },
    })
  })
}
