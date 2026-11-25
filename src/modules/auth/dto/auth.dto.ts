import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsJWT,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72, example: 'correct-horse' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Liddell' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @Transform(normaliseEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'correct-horse' })
  @IsString()
  @MaxLength(200)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsJWT()
  refreshToken: string;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: '15m' })
  expiresIn: string;
}
