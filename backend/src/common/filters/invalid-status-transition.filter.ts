import { ArgumentsHost, Catch, ExceptionFilter, Logger } from "@nestjs/common";
import { InvalidStatusTransitionException } from "../../appointments/invalid-status-transition.exception";

@Catch(InvalidStatusTransitionException)
export class InvalidStatusTransitionFilter implements ExceptionFilter {
  private readonly logger = new Logger(InvalidStatusTransitionFilter.name);

  catch(exception: InvalidStatusTransitionException, host: ArgumentsHost) {
    const { appointmentId, from, to, actor } = exception.transition;
    this.logger.warn(`Refused status transition appointmentId=${appointmentId} from=${from} to=${to} actor=${actor}`);
    host.switchToHttp().getResponse().status(exception.getStatus()).json(exception.getResponse());
  }
}
