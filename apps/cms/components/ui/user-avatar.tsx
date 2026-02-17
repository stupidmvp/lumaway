import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ENV } from '@/lib/env';
import { Building2, Shield, ExternalLink } from 'lucide-react';
import {
    HoverCard,
    HoverCardTrigger,
    HoverCardContent,
} from '@/components/ui/hover-card';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '@/components/ui/popover';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarRounded = 'full' | 'xs' | 'sm' | 'md' | 'lg';
type TriggerMode = 'click' | 'hover';

export interface UserInfo {
    /** User ID — when provided, enables "View Profile" link */
    userId?: string | null;
    email?: string | null;
    role?: string | null;
    organization?: string | null;
}

interface UserAvatarProps {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    size?: AvatarSize;
    rounded?: AvatarRounded;
    className?: string;
    /** When provided, shows a popup with user details */
    userInfo?: UserInfo;
    /**
     * How the user info popup is triggered.
     * - `click` (default) — best for small avatars (xs), dense UIs, and elements inside other interactive containers.
     * - `hover` — best for sm+ avatars in static list/browse contexts.
     */
    triggerMode?: TriggerMode;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; px: number }> = {
    xs: { container: 'h-4 w-4', text: 'text-[8px]', px: 16 },
    sm: { container: 'h-6 w-6', text: 'text-[10px]', px: 24 },
    md: { container: 'h-8 w-8', text: 'text-xs', px: 32 },
    lg: { container: 'h-10 w-10', text: 'text-sm', px: 40 },
    xl: { container: 'h-12 w-12', text: 'text-base', px: 48 },
};

const roundedStyles: Record<AvatarRounded, string> = {
    full: 'rounded-full',
    xs: 'rounded-xs',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
};

function AvatarImage({
    firstName,
    lastName,
    avatar,
    size = 'sm',
    rounded = 'full',
    className,
}: Omit<UserAvatarProps, 'userInfo' | 'triggerMode'>) {
    const initials = [firstName?.charAt(0), lastName?.charAt(0)]
        .filter(Boolean)
        .join('')
        .toUpperCase();

    const { container, text, px } = sizeStyles[size];
    const roundedClass = roundedStyles[rounded];

    const avatarSrc = avatar
        ? avatar.startsWith('http') ? avatar : `${ENV.S3_URL_BASE}${avatar}`
        : null;

    return (
        <div
            className={cn(
                container,
                roundedClass,
                'bg-background-tertiary border border-border flex items-center justify-center overflow-hidden flex-shrink-0 relative',
                className,
            )}
        >
            {avatarSrc ? (
                <Image
                    src={avatarSrc}
                    alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Avatar'}
                    width={px}
                    height={px}
                    className="h-full w-full object-cover"
                    unoptimized={!avatarSrc.startsWith('https://ik.imagekit.io')}
                />
            ) : (
                <span className={cn(text, 'font-bold text-foreground-muted leading-none')}>
                    {initials || '?'}
                </span>
            )}
        </div>
    );
}

/** Shared popup content for both click and hover modes */
function UserInfoContent({
    firstName,
    lastName,
    avatar,
    rounded,
    userInfo,
}: Pick<UserAvatarProps, 'firstName' | 'lastName' | 'avatar' | 'rounded'> & { userInfo: UserInfo }) {
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    const profileHref = userInfo.userId ? `/users/${userInfo.userId}` : null;

    const nameElement = fullName ? (
        profileHref ? (
            <Link
                href={profileHref}
                className="text-sm font-semibold text-foreground truncate hover:text-accent-blue transition-colors"
            >
                {fullName}
            </Link>
        ) : (
            <span className="text-sm font-semibold text-foreground truncate">
                {fullName}
            </span>
        )
    ) : null;

    return (
        <>
            <div className="flex items-center gap-3 p-3">
                {profileHref ? (
                    <Link href={profileHref} className="shrink-0">
                        <AvatarImage
                            firstName={firstName}
                            lastName={lastName}
                            avatar={avatar}
                            size="lg"
                            rounded={rounded}
                            className="h-10 w-10 hover:opacity-80 transition-opacity"
                        />
                    </Link>
                ) : (
                    <AvatarImage
                        firstName={firstName}
                        lastName={lastName}
                        avatar={avatar}
                        size="lg"
                        rounded={rounded}
                        className="h-10 w-10"
                    />
                )}
                <div className="flex flex-col min-w-0">
                    {nameElement}
                    {userInfo.email && (
                        <span className="text-xs text-foreground-muted truncate">
                            {userInfo.email}
                        </span>
                    )}
                </div>
            </div>

            {(userInfo.organization || userInfo.role) && (
                <div className="border-t border-border px-3 py-2 space-y-1.5">
                    {userInfo.organization && (
                        <div className="flex items-center gap-2 text-xs text-foreground-muted">
                            <Building2 className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="truncate">{userInfo.organization}</span>
                        </div>
                    )}
                    {userInfo.role && (
                        <div className="flex items-center gap-2 text-xs text-foreground-muted">
                            <Shield className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="capitalize">{userInfo.role}</span>
                        </div>
                    )}
                </div>
            )}

            {profileHref && (
                <div className="border-t border-border px-3 py-2">
                    <Link
                        href={profileHref}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
                    >
                        <ExternalLink className="h-3 w-3" />
                        View profile
                    </Link>
                </div>
            )}
        </>
    );
}

const POPUP_CONTENT_CLASS = "w-64 rounded-lg border border-border bg-background p-0 shadow-lg";

export function UserAvatar({
    firstName,
    lastName,
    avatar,
    size = 'sm',
    rounded = 'full',
    className,
    userInfo,
    triggerMode = 'click',
}: UserAvatarProps) {
    // Without userInfo, render a plain avatar (no popup)
    if (!userInfo) {
        return (
            <AvatarImage
                firstName={firstName}
                lastName={lastName}
                avatar={avatar}
                size={size}
                rounded={rounded}
                className={className}
            />
        );
    }

    const avatarElement = (
        <AvatarImage
            firstName={firstName}
            lastName={lastName}
            avatar={avatar}
            size={size}
            rounded={rounded}
            className={className}
        />
    );

    const contentProps = { firstName, lastName, avatar, rounded, userInfo };

    // Hover mode — uses Radix HoverCard (designed for hover interactions)
    if (triggerMode === 'hover') {
        return (
            <HoverCard openDelay={250} closeDelay={150}>
                <HoverCardTrigger asChild>
                    <button type="button" className="cursor-pointer focus:outline-none">
                        {avatarElement}
                    </button>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start" sideOffset={6}>
                    <UserInfoContent {...contentProps} />
                </HoverCardContent>
            </HoverCard>
        );
    }

    // Click mode (default) — uses Radix Popover (designed for click interactions)
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" className="cursor-pointer focus:outline-none">
                    {avatarElement}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={6}
                className={POPUP_CONTENT_CLASS}
            >
                <UserInfoContent {...contentProps} />
            </PopoverContent>
        </Popover>
    );
}
