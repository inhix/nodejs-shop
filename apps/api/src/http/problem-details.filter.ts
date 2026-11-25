import { STATUS_CODES } from 'node:http';

import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ProblemDetails } from '@shop/contracts';

/**
 * A deliberate error response with extra Problem Details members. It is part of normal
 * operation (e.g. readiness reporting 503), so the filter does not log it as unhandled.
 */
export class ProblemException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly extensions: Readonly<Record<string, unknown>>,
  ) {
    super(STATUS_CODES[status] ?? 'Error', status);
  }
}

export function toProblemDetails(
  exception: unknown,
  instance: string,
  requestId: string | undefined,
): ProblemDetails {
  const status =
    exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  const problem: ProblemDetails = {
    // Extensions go first, so they cannot replace type, title, status or instance.
    ...(exception instanceof ProblemException && exception.extensions),
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    instance,
  };
  // Client errors explain themselves; server errors never expose internals.
  if (exception instanceof HttpException && status < 500) {
    problem.detail = exception.message;
  }
  if (requestId !== undefined) {
    problem.requestId = requestId;
  }
  return problem;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const problem = toProblemDetails(exception, request.url, request.id);

    if (problem.status >= 500 && !(exception instanceof ProblemException)) {
      this.logger.error({ err: exception }, 'Unhandled exception');
    }

    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }
}
