import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ProfilePage as ProfilePageComponent } from "@/components/profile/ProfilePage";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  return <ProfilePageComponent session={session} />;
}
