'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCurrentUser, useUpdateProfile, PasswordService } from '@luma/infra';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUpload, FileWithProgress } from '@/components/ui/file-upload';
import { Loader2, Camera, Save, Eye, EyeOff, Info, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { MainContent } from '@/components/shared/MainContent';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ProfilePage() {
    const { data: user, isLoading } = useCurrentUser();
    const updateProfile = useUpdateProfile();
    const t = useTranslations('Profile');
    const tp = useTranslations('ChangePassword');
    const tc = useTranslations('Common');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Change password state
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
    });
    const [changingPassword, setChangingPassword] = useState(false);

    const passwordValidation = useMemo(() => {
        const pwd = passwords.newPassword;
        return [
            { id: 'min', label: tp('minLength'), met: pwd.length >= 8 },
            { id: 'lower', label: tp('lowercase'), met: /[a-z]/.test(pwd) },
            { id: 'upper', label: tp('uppercase'), met: /[A-Z]/.test(pwd) },
            { id: 'number', label: tp('number'), met: /[0-9]/.test(pwd) },
        ];
    }, [passwords.newPassword, tp]);

    const isPasswordFormValid =
        passwordValidation.every((v) => v.met) &&
        passwords.newPassword === passwords.confirmPassword &&
        passwords.newPassword !== '' &&
        passwords.currentPassword !== '';

    const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
        setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleChangePassword = async () => {
        if (!isPasswordFormValid) return;
        setChangingPassword(true);
        try {
            await PasswordService.changePassword({
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword,
            });
            toast.success(tp('passwordChanged'));
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            console.error('Error changing password:', err);
            const msg = err.response?.data?.error;
            if (msg?.includes('incorrect')) {
                toast.error(tp('incorrectPassword'));
            } else {
                toast.error(tp('changeFailed'));
            }
        } finally {
            setChangingPassword(false);
        }
    };

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setAvatarUrl(user.avatar || null);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const changed =
            firstName !== (user.firstName || '') ||
            lastName !== (user.lastName || '') ||
            avatarUrl !== (user.avatar || null);
        setHasChanges(changed);
    }, [firstName, lastName, avatarUrl, user]);

    const handleAvatarUpload = (files: FileWithProgress[]) => {
        const file = files[0];
        if (file?.fileUrl) {
            setAvatarUrl(file.fileUrl);
        }
    };

    const handleSave = async () => {
        try {
            await updateProfile.mutateAsync({
                firstName,
                lastName,
                avatar: avatarUrl,
            });
            toast.success(t('profileUpdated'));
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(t('profileUpdateFailed'));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-foreground-muted">{t('couldNotLoadProfile')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || updateProfile.isPending}
                        className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                    >
                        {updateProfile.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">
                            {updateProfile.isPending ? tc('saving') : tc('save')}
                        </span>
                    </Button>
            </div>
            </header>

            <MainContent maxWidth="max-w-2xl">
                <div className="space-y-6">
            {/* Avatar */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('avatarTitle')}</CardTitle>
                    <CardDescription>
                        {t('avatarDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-5">
                        <FileUpload
                            s3Type="avatar"
                            uploadPath={`avatars/${user.id}`}
                            allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
                            maxSize={5242880}
                            multiple={false}
                            showDropzone={false}
                            showFiles={false}
                            showInfo={false}
                            showPlaceholder={false}
                            className="w-auto"
                            contentClassName="justify-start"
                            onUploadSuccess={handleAvatarUpload}
                            onUploadError={(error) => {
                                console.error('Avatar upload error:', error);
                                toast.error(t('avatarUploadFailed'));
                            }}
                        >
                            <div className="relative group cursor-pointer">
                                <UserAvatar
                                    firstName={firstName}
                                    lastName={lastName}
                                    avatar={avatarUrl}
                                    size="xl"
                                    className="h-20 w-20 text-lg transition-opacity group-hover:opacity-80"
                                />
                                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                                    <Camera className="h-4 w-4 text-white" />
                                    <span className="text-[10px] font-medium text-white">{tc('change')}</span>
                                </div>
                            </div>
                        </FileUpload>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium text-foreground">
                                {[firstName, lastName].filter(Boolean).join(' ') || t('yourAvatar')}
                            </p>
                            <p className="text-xs text-foreground-subtle">
                                {avatarUrl ? t('clickToReplace') : t('clickToUpload')}
                            </p>
                            {avatarUrl && (
                                <button
                                    type="button"
                                    className="text-xs text-foreground-muted hover:text-destructive transition-colors text-left mt-1 w-fit"
                                    onClick={() => setAvatarUrl(null)}
                                >
                                    {t('removePhoto')}
                                </button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('profileInfoTitle')}</CardTitle>
                    <CardDescription>
                        {t('profileInfoDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">{t('firstName')}</Label>
                            <Input
                                id="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder={t('firstNamePlaceholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">{t('lastName')}</Label>
                            <Input
                                id="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder={t('lastNamePlaceholder')}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">{t('email')}</Label>
                        <Input
                            id="email"
                            value={user.email}
                            disabled
                            className="bg-background-secondary text-foreground-muted"
                        />
                        <p className="text-xs text-foreground-subtle">
                            {t('emailCannotBeChanged')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{tp('title')}</CardTitle>
                    <CardDescription>{tp('description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Current Password */}
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">{tp('currentPassword')}</Label>
                        <div className="relative">
                            <Input
                                id="currentPassword"
                                type={showPasswords.currentPassword ? 'text' : 'password'}
                                value={passwords.currentPassword}
                                onChange={(e) =>
                                    setPasswords((prev) => ({ ...prev, currentPassword: e.target.value }))
                                }
                                placeholder={tp('currentPasswordPlaceholder')}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-foreground-muted"
                                onClick={() => togglePasswordVisibility('currentPassword')}
                            >
                                {showPasswords.currentPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="newPassword">{tp('newPassword')}</Label>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-foreground-muted cursor-pointer hover:text-foreground transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent className="p-4 w-64" side="right">
                                        <p className="text-xs font-semibold mb-2">{tp('securityRequirements')}</p>
                                        <div className="space-y-1">
                                            {passwordValidation.map((req) => (
                                                <div
                                                    key={req.id}
                                                    className={`flex items-center gap-2 text-xs ${
                                                        req.met ? 'text-accent-green' : 'text-foreground-muted'
                                                    }`}
                                                >
                                                    {req.met ? (
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    ) : (
                                                        <Circle className="w-3 h-3" />
                                                    )}
                                                    <span>{req.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="relative">
                            <Input
                                id="newPassword"
                                type={showPasswords.newPassword ? 'text' : 'password'}
                                value={passwords.newPassword}
                                onChange={(e) =>
                                    setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))
                                }
                                placeholder={tp('newPasswordPlaceholder')}
                                className={
                                    passwords.newPassword.length > 0
                                        ? passwordValidation.every((v) => v.met)
                                            ? 'border-accent-green focus-visible:ring-accent-green'
                                            : 'border-amber-500 focus-visible:ring-amber-500'
                                        : ''
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-foreground-muted"
                                onClick={() => togglePasswordVisibility('newPassword')}
                            >
                                {showPasswords.newPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        {passwords.newPassword.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {passwordValidation.map((req) => (
                                    <div
                                        key={req.id}
                                        className={`flex items-center gap-2 text-xs ${
                                            req.met ? 'text-accent-green' : 'text-foreground-muted'
                                        }`}
                                    >
                                        {req.met ? (
                                            <CheckCircle2 className="w-3 h-3" />
                                        ) : (
                                            <Circle className="w-3 h-3" />
                                        )}
                                        <span>{req.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{tp('confirmPassword')}</Label>
                        <div className="relative">
                            <Input
                                id="confirmPassword"
                                type={showPasswords.confirmPassword ? 'text' : 'password'}
                                value={passwords.confirmPassword}
                                onChange={(e) =>
                                    setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))
                                }
                                placeholder={tp('confirmPasswordPlaceholder')}
                                className={
                                    passwords.confirmPassword.length > 0 &&
                                    passwords.confirmPassword !== passwords.newPassword
                                        ? 'border-red-500 focus-visible:ring-red-500'
                                        : ''
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-foreground-muted"
                                onClick={() => togglePasswordVisibility('confirmPassword')}
                            >
                                {showPasswords.confirmPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        {passwords.confirmPassword &&
                            passwords.confirmPassword !== passwords.newPassword && (
                                <p className="text-xs text-destructive">{tp('passwordsMustMatch')}</p>
                            )}
                    </div>

                    <Button
                        className="w-full mt-2"
                        onClick={handleChangePassword}
                        disabled={!isPasswordFormValid || changingPassword}
                    >
                        {changingPassword ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {tp('updating')}
                            </>
                        ) : (
                            tp('updatePassword')
                        )}
                    </Button>
                </CardContent>
            </Card>
            </div>
            </MainContent>
        </div>
    );
}
