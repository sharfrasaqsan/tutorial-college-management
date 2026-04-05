import TeacherSidebar from "@/components/layout/TeacherSidebar";
import TeacherTopbar from "@/components/layout/TeacherTopbar";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <TeacherSidebar />
      <div className="flex-1 flex flex-col md:ml-64 w-full min-w-0">
        <TeacherTopbar />
        <main className="flex-1 p-4 md:p-8 pb-32 md:pb-8 overflow-y-auto w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
