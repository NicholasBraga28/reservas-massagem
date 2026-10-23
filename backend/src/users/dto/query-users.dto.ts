import { UserRole, UserStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class QueryUsersDto {
  @IsOptional()
  @IsEnum(UserRole)
  readonly role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  readonly status?: UserStatus;

  @IsOptional()
  @IsString()
  readonly search?: string;
}
