import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('Unhandled Exception:', exception);
    }

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    let message = 'Internal server error';
    if (typeof errorResponse === 'string') {
      message = errorResponse;
    } else if (typeof errorResponse === 'object' && errorResponse !== null) {
      message = (errorResponse as any).message || message;
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message: message,
      },
    });
  }
}
