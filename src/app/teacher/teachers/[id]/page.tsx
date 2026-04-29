import TeacherProfileView from "@/components/admin/TeacherProfileView";

export default async function TeacherFacultyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherProfileView teacherId={id} />;
}
