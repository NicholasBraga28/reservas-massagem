import { UserRole } from "@prisma/client";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";

const trimmed = ({ value }: TransformFnParams): unknown => (typeof value === "string" ? value.trim() : value);

const normalizedEmail = (params: TransformFnParams): unknown => {
  const value = trimmed(params);
  return typeof value === "string" ? value.toLowerCase() : value;
};

export class CreateUserDto {
  @Transform(normalizedEmail)
  @IsEmail()
  readonly email!: string;

  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @IsEnum(UserRole)
  readonly role!: UserRole;
}
