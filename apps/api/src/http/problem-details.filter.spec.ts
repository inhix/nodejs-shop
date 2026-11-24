import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { toProblemDetails } from './problem-details.filter.js';

describe('toProblemDetails', () => {
  it('maps an HttpException to its status with a detail message', () => {
    expect(toProblemDetails(new NotFoundException('Product not found'), '/p/1', 'r1')).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Product not found',
      instance: '/p/1',
      requestId: 'r1',
    });
  });

  it('keeps client error details', () => {
    expect(toProblemDetails(new BadRequestException('Bad SKU'), '/x', undefined).detail).toBe(
      'Bad SKU',
    );
  });

  it('turns unknown errors into a 500 without leaking the message', () => {
    const problem = toProblemDetails(new Error('db password is hunter2'), '/x', 'r2');
    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      instance: '/x',
      requestId: 'r2',
    });
  });
});
