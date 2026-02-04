import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Loader2, Download, File, Folder, Edit } from 'lucide-react';
import { Material, Semester, Teacher } from '@/types/database';
import { format } from 'date-fns';

export default function Materials() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    semester_id: '',
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    semester_id: '',
  });

  useEffect(() => {
    fetchData();
  }, [user, role]);

  const fetchData = async () => {
    try {
      if (role === 'teacher' && user) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (teacherData) {
          setTeacher(teacherData as Teacher);

          const { data: assignmentsData } = await supabase
            .from('teacher_semester_assignments')
            .select('semester_id')
            .eq('teacher_id', teacherData.id);

          const semesterIds = assignmentsData?.map(a => a.semester_id) || [];

          const { data } = await supabase
            .from('materials')
            .select('*, semester:semesters(*)')
            .eq('teacher_id', teacherData.id)
            .order('created_at', { ascending: false });

          if (data) setMaterials(data as Material[]);

          const { data: semData } = await supabase
            .from('semesters')
            .select('*')
            .in('id', semesterIds);

          if (semData) setSemesters(semData as Semester[]);
        }
      } else if (role === 'student' && user) {
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (studentData) {
          const { data } = await supabase
            .from('materials')
            .select('*, semester:semesters(*), teacher:teachers(*, profile:profiles(*))')
            .eq('semester_id', studentData.current_semester_id)
            .order('created_at', { ascending: false });

          if (data) setMaterials(data as Material[]);
        }
      } else if (role === 'admin') {
        const [materialsRes, semestersRes] = await Promise.all([
          supabase.from('materials').select('*, semester:semesters(*), teacher:teachers(*, profile:profiles(*))').order('created_at', { ascending: false }),
          supabase.from('semesters').select('*').order('semester_number'),
        ]);

        if (materialsRes.data) setMaterials(materialsRes.data as Material[]);
        if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!teacher) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `materials/${teacher.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('academic-files')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('academic-files')
      .getPublicUrl(fileName);

    return { url: publicUrl, name: file.name, type: file.type };
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;

    setIsCreating(true);

    try {
      let fileData = null;
      if (selectedFile) {
        setUploadingFile(true);
        fileData = await handleFileUpload(selectedFile);
        setUploadingFile(false);
      }

      const { error } = await supabase.from('materials').insert({
        teacher_id: teacher.id,
        semester_id: formData.semester_id,
        title: formData.title,
        description: formData.description,
        file_url: fileData?.url,
        file_name: fileData?.name,
        file_type: fileData?.type,
      });

      if (error) throw error;

      toast({
        title: 'Material Uploaded',
        description: 'The study material has been uploaded successfully.',
      });

      setIsDialogOpen(false);
      setFormData({ title: '', description: '', semester_id: '' });
      setSelectedFile(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setEditFormData({
      title: material.title,
      description: material.description || '',
      semester_id: material.semester_id,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('materials')
        .update({
          title: editFormData.title,
          description: editFormData.description,
          semester_id: editFormData.semester_id,
        })
        .eq('id', editingMaterial.id);

      if (error) throw error;

      toast({
        title: 'Material Updated',
        description: 'The study material has been updated successfully.',
      });

      setIsEditDialogOpen(false);
      setEditingMaterial(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';
  const canEdit = isTeacher || isAdmin;

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <File className="w-5 h-5" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (fileType.includes('sheet') || fileType.includes('excel')) return <FileText className="w-5 h-5 text-green-500" />;
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return <FileText className="w-5 h-5 text-orange-500" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-accent" />
            Study Materials
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher ? 'Upload and manage study materials' : 'Access study materials'}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Upload Material
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Study Material</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateMaterial} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester_id">Semester *</Label>
                  <Select
                    value={formData.semester_id}
                    onValueChange={(value) => setFormData({ ...formData, semester_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((semester) => (
                        <SelectItem key={semester.id} value={semester.id}>
                          {semester.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">File *</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating || !selectedFile}>
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {uploadingFile ? 'Uploading...' : 'Saving...'}
                      </>
                    ) : (
                      'Upload'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Study Material</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateMaterial} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit_title">Title *</Label>
              <Input
                id="edit_title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_semester_id">Semester *</Label>
              <Select
                value={editFormData.semester_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, semester_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Materials Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {materials.map((material, index) => (
            <Card key={material.id} className="card-interactive animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-accent/10">
                    {getFileIcon(material.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-lg truncate">{material.title}</h3>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => handleEditMaterial(material)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(material.semester as any)?.name}
                    </p>
                  </div>
                </div>
                {material.description && (
                  <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                    {material.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(material.created_at), 'MMM d, yyyy')}
                  </span>
                  {material.file_url && (
                    <a
                      href={material.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No study materials found</p>
        </div>
      )}
    </div>
  );
}
