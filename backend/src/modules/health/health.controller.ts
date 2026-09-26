import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-09-26T05:30:00.000Z' },
        service: { type: 'string', example: 'StockSense API' },
        version: { type: 'string', example: '1.0.0' },
        uptime: { type: 'number', example: 12.34 },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'StockSense API',
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }
}
