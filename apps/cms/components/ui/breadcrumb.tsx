'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject, useWalkthrough, useUserProfile } from '@luma/infra';
import { useTranslations } from 'next-intl';

export function Breadcrumb() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbSegments = segments.slice(1); // Remove locale from segments
    const t = useTranslations('Breadcrumb');

    // Identify if we are in walkthrough context
    const walkthroughIdIndex = breadcrumbSegments.indexOf('walkthroughs') + 1;
    const walkthroughId = walkthroughIdIndex > 0 ? breadcrumbSegments[walkthroughIdIndex] : null;

    // Identify if we are in project detail context
    const projectIdIndex = breadcrumbSegments.indexOf('projects') + 1;
    const directProjectSegment = projectIdIndex > 0 ? breadcrumbSegments[projectIdIndex] : undefined;
    const directProjectId = directProjectSegment && directProjectSegment.length > 20
        ? directProjectSegment
        : null;

    // Identify if we are in user profile context
    const userIdIndex = breadcrumbSegments.indexOf('users') + 1;
    const directUserSegment = userIdIndex > 0 ? breadcrumbSegments[userIdIndex] : undefined;
    const directUserId = directUserSegment && directUserSegment.length > 20
        ? directUserSegment
        : null;

    // Fetch Walkthrough Data if ID is present
    const { data: walkthroughData } = useWalkthrough(walkthroughId || '');

    // Fetch Project Data: from walkthrough context OR direct project page
    const projectIdToFetch = walkthroughData?.projectId || directProjectId || '';
    const { data: projectData } = useProject(projectIdToFetch);

    // Fetch User Profile Data if user ID is present
    const { data: userProfileData } = useUserProfile(directUserId || '');

    const getFullSegments = () => {
        // SCENARIO 1: Walkthrough Editor / Details
        if (walkthroughData && walkthroughData.projectId) {
            const project = projectData; // Single project data
            const projectName = project?.name || t('project');

            // Path: Projects -> [Project Name] -> [Walkthrough Title]
            return [
                { label: t('projects'), path: `/${segments[0]}/projects` },
                { label: projectName, path: `/${segments[0]}/projects/${walkthroughData.projectId}` },
                { label: walkthroughData.title || t('walkthrough'), path: `/${segments[0]}/walkthroughs/${walkthroughData.id}` }
            ];
        }

        // SCENARIO 2: Default / Project List / Other pages
        // Map simple segments
        return breadcrumbSegments.map((segment, index) => {
            // Construct absolute path up to this segment
            // segments[0] is locale
            const path = `/${segments[0]}/${breadcrumbSegments.slice(0, index + 1).join('/')}`;
            let label = segment;

            // Simple remapping
            const labels: Record<string, string> = {
                'projects': t('projects'),
                'walkthroughs': t('walkthroughs'),
                'settings': t('settings'),
                'new': t('new'),
                'profile': t('profile'),
                'my-organization': t('myOrganization'),
                'organizations': t('organizations'),
                'members': t('members'),
                'users': t('users'),
                'steps': t('steps'),
                'activity': t('activity'),
            };

            // If it's a UUID (approximation), try to resolve or show generic
            if (segment.length > 20) {
                if (breadcrumbSegments[index - 1] === 'projects') {
                    label = projectData?.name || segment;
                } else if (breadcrumbSegments[index - 1] === 'walkthroughs') {
                    label = t('walkthrough');
                } else if (breadcrumbSegments[index - 1] === 'users') {
                    const userName = userProfileData
                        ? [userProfileData.firstName, userProfileData.lastName].filter(Boolean).join(' ')
                        : null;
                    label = userName || t('user');
                } else {
                    label = '...';
                }
            } else {
                label = labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
            }

            return { label, path };
        });
    };

    const finalSegments = getFullSegments();

    if (breadcrumbSegments.length === 0) return null;

    return (
        <nav className="flex items-center space-x-1.5 sm:space-x-2 text-sm text-foreground-muted min-w-0 overflow-hidden">
            <Link
                href="/"
                className="hover:text-foreground transition-colors shrink-0"
            >
                <Home className="h-4 w-4" />
            </Link>

            {finalSegments.map((seg, index) => {
                const isLast = index === finalSegments.length - 1;

                return (
                    <div key={seg.path} className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                        <span className="text-foreground-muted/40 text-xs shrink-0">/</span>
                        {isLast ? (
                            <span className="text-foreground font-medium px-1 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[300px] lowercase">
                                {seg.label}
                            </span>
                        ) : (
                            <Link
                                href={seg.path}
                                className="hover:text-foreground hover:underline underline-offset-4 transition-colors px-1 truncate max-w-[80px] sm:max-w-[140px] lg:max-w-[200px] lowercase"
                            >
                                {seg.label}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
