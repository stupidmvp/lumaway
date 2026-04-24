import { redirect } from 'next/navigation';

export default async function LumenReviewPage({
    params,
}: {
    params: Promise<{ id: string; lumenId: string }>;
}) {
    const { id, lumenId } = await params;
    redirect(`/projects/${id}/lumens/${lumenId}`);
}
