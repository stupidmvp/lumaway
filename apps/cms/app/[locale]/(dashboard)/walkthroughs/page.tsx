import { WalkthroughsList } from '@/components/shared/WalkthroughsList';
import { WalkthroughsHeader } from '@/components/walkthroughs/WalkthroughsHeader';
import { MainContent } from '@/components/shared/MainContent';

export default function WalkthroughsPage() {
    return (
        <div className="flex flex-col h-full bg-background">
            <WalkthroughsHeader />

            <MainContent>
                <WalkthroughsList />
            </MainContent>
        </div>
    );
}
