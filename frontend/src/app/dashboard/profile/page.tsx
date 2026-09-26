import PageContainer from '@/components/layout/page-container';
import { ProfileView } from '@/features/auth/components/profile-view';

export const metadata = {
  title: 'StockSense — My Profile',
};

export default function ProfilePage() {
  return (
    <PageContainer>
      <div className="p-4 sm:p-6 lg:p-8">
        <ProfileView />
      </div>
    </PageContainer>
  );
}
