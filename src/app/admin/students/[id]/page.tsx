import StudentProfileView from "@/components/admin/StudentProfileView";

export default async function AdminStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentProfileView studentId={id} />;
}
