import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /** Liveness: the process is up and serving HTTP. Deliberately has no dependencies. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
