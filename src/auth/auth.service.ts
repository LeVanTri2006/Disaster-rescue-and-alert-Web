import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { FirebaseSosPublisher } from '../firebase/firebase-sos.publisher';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @Optional() private readonly firebasePublisher?: FirebaseSosPublisher,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingEmail = registerDto.email ? await this.usersService.findByEmail(registerDto.email) : null;
    if (existingEmail) {
      throw new BadRequestException('Email already in use');
    }

    const existingPhone = registerDto.phone ? await this.usersService.findByPhone(registerDto.phone) : null;
    if (existingPhone) {
      throw new BadRequestException('Phone already in use');
    }

    if (!registerDto.email && !registerDto.phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    
    let firebaseUid: string | undefined;
    if (this.firebasePublisher?.enabled) {
      try {
        let firebasePhone = registerDto.phone;
        if (firebasePhone && firebasePhone.startsWith('0') && firebasePhone.length >= 10) {
          firebasePhone = '+84' + firebasePhone.substring(1);
        }

        firebaseUid = await this.firebasePublisher.createUser(
          registerDto.email,
          firebasePhone,
          registerDto.password,
          registerDto.fullName
        );
      } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
          throw new BadRequestException('Email already in use in Firebase');
        }
        if (error.code === 'auth/phone-number-already-exists') {
          throw new BadRequestException('Phone number already in use in Firebase');
        }
        // Throw general error for other Firebase issues
        throw new BadRequestException(`Firebase Error: ${error.message}`);
      }
    }

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      firebaseUid,
    });

    const payload = { sub: user.id, role: user.role };
    
    return {
      user,
      accessToken: this.jwtService.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any }),
      refreshToken: this.jwtService.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }),
      isNewUser: true,
    };
  }

  async login(loginDto: LoginDto) {
    let user;
    if (loginDto.email) {
      user = await this.usersService.findByEmail(loginDto.email);
    } else if (loginDto.phone) {
      user = await this.usersService.findByPhone(loginDto.phone);
    } else {
      throw new BadRequestException('Either email or phone must be provided for login');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('User is banned');
    }

    if (user.status === UserStatus.INACTIVE || user.status === UserStatus.PENDING) {
      throw new ForbiddenException('User is not active');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, role: user.role };
    
    return {
      accessToken: this.jwtService.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any }),
      refreshToken: this.jwtService.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }),
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      const user = await this.usersService.findById(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }
      if (user.status === UserStatus.BANNED || user.status === UserStatus.INACTIVE) {
        throw new ForbiddenException('User account is not active');
      }

      const newPayload = { sub: user.id, role: user.role };
      return {
        accessToken: this.jwtService.sign(newPayload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any }),
        refreshToken: this.jwtService.sign(newPayload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }),
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async createFirebaseToken(userId: string, role: string) {
    if (!this.firebasePublisher?.enabled) {
      throw new ServiceUnavailableException('Firebase authentication is not configured');
    }
    return this.firebasePublisher.createCustomToken(userId, role);
  }

  async googleLogin(idToken: string, role?: UserRole) {
    if (!this.firebasePublisher?.enabled) {
      throw new ServiceUnavailableException('Firebase authentication is not configured');
    }
    
    let decodedToken;
    try {
      decodedToken = await this.firebasePublisher.verifyIdToken(idToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const { uid, email, name } = decodedToken;
    
    let isNewUser = false;
    const user = await (async () => {
      // 1. Try to find by firebaseUid
      const userByUid = await this.usersService.findByFirebaseUid(uid);
      if (userByUid) return userByUid;

      // 2. Try to find by email
      if (email) {
        const userByEmail = await this.usersService.findByEmail(email);
        if (userByEmail) {
          // Link the existing user
          return await this.usersService.linkFirebaseUid(userByEmail.id, uid);
        }
      }

      // 3. Create new user
      isNewUser = true;
      return await this.usersService.create({
        email: email,
        fullName: name || 'Google User',
        firebaseUid: uid,
        role: role || UserRole.USER,
        status: UserStatus.ACTIVE,
      });
    })();

    if (!user) {
      throw new BadRequestException('Could not resolve user from Google login');
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('User is banned');
    }

    if (user.status === UserStatus.INACTIVE || user.status === UserStatus.PENDING) {
      throw new ForbiddenException('User is not active');
    }

    const payload = { sub: user.id, role: user.role };
    
    return {
      accessToken: this.jwtService.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any }),
      refreshToken: this.jwtService.sign(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }),
      isNewUser,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { identifier } = forgotPasswordDto;
    
    // Determine if identifier is an email or phone
    const isEmail = identifier.includes('@');

    let user = isEmail ? await this.usersService.findByEmail(identifier) : await this.usersService.findByPhone(identifier);
    
    if (!user) {
      // Return success even if user not found to prevent user enumeration
      return { message: 'If the provided identifier is valid, an OTP has been sent.' };
    }

    if (isEmail) {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otp, 10);
      
      // Expires in 15 minutes
      const expiresAt = (globalThis as any).Temporal.Now.instant().add({ minutes: 15 });

      await this.usersService.setResetOtp(user.id, hashedOtp, expiresAt);

      // Send OTP via Email using MailService
      await this.mailService.sendOtpEmail(identifier, otp);
    } else {
      // For phone, the client will trigger Firebase Phone Auth
      // We don't need to generate or store an OTP here.
    }

    return { message: 'If the provided identifier is valid, an OTP has been sent.' };
  }

  async verifyOtp(identifier: string, otp: string) {
    const user = await this.usersService.findByEmail(identifier) || await this.usersService.findByPhone(identifier);

    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const isExpired = (globalThis as any).Temporal.Instant.compare(
      (globalThis as any).Temporal.Now.instant(),
      user.resetPasswordExpiresAt
    ) > 0;

    if (isExpired) {
      throw new BadRequestException('OTP has expired');
    }

    const isValidOtp = await bcrypt.compare(otp, user.resetPasswordOtp);
    if (!isValidOtp) {
      throw new BadRequestException('Invalid OTP');
    }
    return true;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { identifier, otp, newPassword } = resetPasswordDto;
    const user = await this.usersService.findByEmail(identifier) || await this.usersService.findByPhone(identifier);

    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const isExpired = (globalThis as any).Temporal.Instant.compare(
      (globalThis as any).Temporal.Now.instant(),
      user.resetPasswordExpiresAt
    ) > 0;

    if (isExpired) {
      throw new BadRequestException('OTP has expired');
    }

    const isValidOtp = await bcrypt.compare(otp, user.resetPasswordOtp);
    if (!isValidOtp) {
      throw new BadRequestException('Invalid OTP');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.clearResetOtp(user.id);

    return { message: 'Password reset successfully' };
  }

  async resetPasswordFirebase(firebaseIdToken: string, newPassword: string) {
    if (!this.firebasePublisher?.enabled) {
      throw new ServiceUnavailableException('Firebase authentication is not configured');
    }
    
    let decodedToken;
    try {
      decodedToken = await this.firebasePublisher.verifyIdToken(firebaseIdToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }

    let phone = decodedToken.phone_number;
    if (!phone) {
      throw new BadRequestException('Firebase token does not contain a phone number');
    }

    // Convert +84xxxx to 0xxxx if necessary to match our DB format
    if (phone.startsWith('+84')) {
      phone = '0' + phone.substring(3);
    }

    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new BadRequestException('No user found with this phone number');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: 'Password reset successfully via Firebase Phone Auth' };
  }
}
