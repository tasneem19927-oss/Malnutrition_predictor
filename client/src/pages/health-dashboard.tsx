import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  UserPlus,
  FileText,
  Search,
  Plus,
  ClipboardList,
  Activity,
  Users,
  AlertCircle,
  AlertTriangle,
  LogOut,
  BarChart3,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Eye,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChildAssessment {
  id: string;
  childName: string;
  childAge: number;
  gender: string;
  governorate: string;
  district: string;
  height: number;
  weight: number;
  muac: number;
  prediction: string;
  severity: string;
  status: string;
  assessedBy: string;
  assessmentDate: string;
  followUpDate?: string;
  zScore?: number;
  waz?: number;
  haz?: number;
  wfl?: number;
}

interface PatientInfo {
  id: string;
  name: string;
  age: number;
  gender: string;
  governorate: string;
  district: string;
  phoneNumber?: string;
  parentName?: string;
  assessmentCount: number;
  lastAssessment: string;
  riskLevel: string;
}

interface HealthDashboardStats {
  totalAssessments: number;
  severeCases: number;
  moderateCases: number;
  followUpNeeded: number;
  newAssessments: number;
  stuntingCount: number;
  wastingCount: number;
  byGovernorate: Record<string, number>;
}

const governorates = ['تعز', 'عدن', 'الحديدة', 'إب', 'صنعاء', 'صعدة', 'حجة', 'المحويت', 'الضالع', 'لحج', 'أبين', 'شبوة', 'حضرموت', 'المهرة', 'عمران', 'ذمار', 'البيضاء', 'ريمة'];

const HealthWorkerDashboard = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isViewDetailOpen, setIsViewDetailOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<ChildAssessment | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: 'male',
    governorate: '',
    district: '',
    phoneNumber: '',
    parentName: '',
  });

  // API: Fetch health dashboard stats and assessments
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    stats: HealthDashboardStats;
    assessments: ChildAssessment[];
    patients: PatientInfo[];
  }>({
    queryKey: ['/api/health/dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/health/dashboard', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    },
  });

  // Fallback to predict/batch if health dashboard not available
  const { data: batchData } = useQuery<ChildAssessment[]>({
    queryKey: ['/api/predict/batch'],
    enabled: !dashboardData,
    staleTime: 5 * 60 * 1000,
  });

  const assessments = dashboardData?.assessments ?? batchData ?? [];
  const stats = dashboardData?.stats;
  const patients = dashboardData?.patients ?? [];

  // Filter assessments
  const filteredAssessments = assessments.filter((assessment) => {
    const matchesSearch = assessment.childName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGovernorate = selectedGovernorate === 'all' || assessment.governorate === selectedGovernorate;
    const matchesSeverity = selectedSeverity === 'all' || assessment.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'all' || assessment.status === selectedStatus;
    return matchesSearch && matchesGovernorate && matchesSeverity && matchesStatus;
  });

  // Calculate stats from API or fallback
  const totalAssessments = stats?.totalAssessments ?? assessments.length;
  const severeCases = stats?.severeCases ?? assessments.filter((a) => a.severity === 'شديد').length;
  const moderateCases = stats?.moderateCases ?? assessments.filter((a) => a.severity === 'متوسط').length;
  const followUpNeeded = stats?.followUpNeeded ?? assessments.filter((a) => a.status === 'تحت المتابعة').length;
  const newAssessments = stats?.newAssessments ?? assessments.filter((a) => a.status === 'جديد').length;

  // Mutation: Add new patient/assessment
  const addAssessmentMutation = useMutation({
    mutationFn: async (assessment: ChildAssessment) => {
      const res = await fetch('/api/predict/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify([assessment]),
      });
      if (!res.ok) throw new Error('Failed to add assessment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/predict/batch'] });
    },
  });

  // Mutation: Delete assessment
  const deleteAssessmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/predict/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete assessment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/predict/batch'] });
      setIsDeleteDialogOpen(false);
    },
  });

  // Severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'شديد': return 'bg-red-500';
      case 'متوسط': return 'bg-yellow-500';
      case 'منخفض': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'جديد': return 'bg-blue-500';
      case 'تحت المتابعة': return 'bg-yellow-500';
      case 'مكتمل': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Handle view details
  const handleViewDetails = (assessment: ChildAssessment) => {
    setSelectedAssessment(assessment);
    setIsViewDetailOpen(true);
  };

  // Handle add patient - sends to prediction API
  const handleAddPatient = () => {
    if (!newPatient.name || !newPatient.age) {
      toast({ title: 'خطأ', description: 'يرجى إدخال اسم الطفل والعمر', variant: 'destructive' });
      return;
    }
    const assessment: ChildAssessment = {
      id: crypto.randomUUID(),
      childName: newPatient.name,
      childAge: parseInt(newPatient.age),
      gender: newPatient.gender,
      governorate: newPatient.governorate,
      district: newPatient.district,
      height: 85,
      weight: 10,
      muac: 12,
      prediction: 'قيد التقييم',
      severity: 'غير محدد',
      status: 'جديد',
      assessedBy: user?.name || 'غير محدد',
      assessmentDate: new Date().toISOString().split('T')[0],
    };
    addAssessmentMutation.mutate(assessment, {
      onSuccess: () => {
        toast({ title: 'تمت الإضافة', description: 'تم تسجيل المريض الجديد بنجاح' });
        setIsAddPatientOpen(false);
        setNewPatient({ name: '', age: '', gender: 'male', governorate: '', district: '', phoneNumber: '', parentName: '' });
      },
      onError: () => {
        toast({ title: 'خطأ', description: 'فشل إضافة المريض', variant: 'destructive' });
      },
    });
  };

  const handleDeleteAssessment = () => {
    if (selectedAssessment) {
      deleteAssessmentMutation.mutate(selectedAssessment.id);
    }
  };

  if (dashboardLoading && !batchData) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center' dir='rtl'>
        <div className='text-center'>
          <Activity className='w-12 h-12 text-blue-500 mx-auto animate-spin mb-4' />
          <p className='text-gray-600'>جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50' dir='rtl'>
      {/* Header */}
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            <div className='flex items-center space-x-4 space-x-reverse'>
              <h1 className='text-2xl font-bold text-gray-900'>لوحة العامل الصحي</h1>
              <Badge variant='secondary' className='bg-blue-100 text-blue-800'>
                {user?.role === 'health_worker' ? 'عامل صحي' : user?.role === 'doctor' ? 'طبيب' : 'مستخدم'}
              </Badge>
            </div>
            <div className='flex items-center space-x-4 space-x-reverse'>
              <Link href='/predict'>
                <Button className='bg-green-600 hover:bg-green-700'>
                  <ClipboardList className='w-4 h-4 ml-2' />
                  تقييم جديد
                </Button>
              </Link>
              <div className='flex items-center space-x-2 space-x-reverse'>
                <span className='text-sm text-gray-600'>{user?.name}</span>
                <Button variant='ghost' size='sm' onClick={logout}>
                  <LogOut className='w-4 h-4 ml-2' />
                  تسجيل خروج
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Statistics Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>إجمالي التقييمات</CardTitle>
              <ClipboardList className='w-4 h-4 text-gray-400' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalAssessments}</div>
              <p className='text-xs text-gray-500'>هذا الشهر</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>حالات شديدة</CardTitle>
              <AlertTriangle className='w-4 h-4 text-red-400' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-red-600'>{severeCases}</div>
              <p className='text-xs text-gray-500'>تتطلب تدخلاً عاجلاً</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>تحت المتابعة</CardTitle>
              <Activity className='w-4 h-4 text-yellow-400' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-yellow-600'>{followUpNeeded}</div>
              <p className='text-xs text-gray-500'>بحاجة لمتابعة</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>تقييمات جديدة</CardTitle>
              <FileText className='w-4 h-4 text-blue-400' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-blue-600'>{newAssessments}</div>
              <p className='text-xs text-gray-500'>تقييمات جديدة اليوم</p>
            </CardContent>
          </Card>
        </div>
        {/* Tabs */}
        <Tabs defaultValue='assessments' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='assessments'>
              <ClipboardList className='w-4 h-4 ml-2' />
              التقييمات
            </TabsTrigger>
            <TabsTrigger value='patients'>
              <Users className='w-4 h-4 ml-2' />
              المرضى
            </TabsTrigger>
            <TabsTrigger value='reports'>
              <BarChart3 className='w-4 h-4 ml-2' />
              التقارير
            </TabsTrigger>
          </TabsList>
          <TabsContent value='assessments'>
            {/* Search and Filter */}
            <Card className='mb-6'>
              <CardContent className='pt-6'>
                <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                  <div className='relative'>
                    <Search className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
                    <Input
                      placeholder='بحث باسم الطفل...'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className='pr-10'
                    />
                  </div>
                  <Select value={selectedGovernorate} onValueChange={setSelectedGovernorate}>
                    <SelectTrigger>
                      <SelectValue placeholder='المحافظة' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>جميع المحافظات</SelectItem>
                      {governorates.map((gov) => (
                        <SelectItem key={gov} value={gov}>
                          {gov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                    <SelectTrigger>
                      <SelectValue placeholder='درجة الشدة' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>الكل</SelectItem>
                      <SelectItem value='شديد'>شديد</SelectItem>
                      <SelectItem value='متوسط'>متوسط</SelectItem>
                      <SelectItem value='منخفض'>منخفض</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder='الحالة' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>الكل</SelectItem>
                      <SelectItem value='جديد'>جديد</SelectItem>
                      <SelectItem value='تحت المتابعة'>تحت المتابعة</SelectItem>
                      <SelectItem value='مكتمل'>مكتمل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Assessments Table */}
            <Card>
              <CardHeader>
                <CardTitle>قائمة التقييمات</CardTitle>
                <CardDescription>عرض جميع تقييمات الأطفال المسجلة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم الطفل</TableHead>
                        <TableHead>العمر</TableHead>
                        <TableHead>المحافظة</TableHead>
                        <TableHead>التشخيص</TableHead>
                        <TableHead>الدرجة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>تاريخ التقييم</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.length === 0 && dashboardData ? (
                        <TableRow>
                          <TableCell colSpan={8} className='text-center py-8'>
                            <AlertCircle className='w-12 h-12 text-gray-400 mx-auto mb-2' />
                            <p className='text-gray-500'>لا توجد تقييمات</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredAssessments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className='text-center py-8'>
                            <AlertCircle className='w-12 h-12 text-gray-400 mx-auto mb-2' />
                            <p className='text-gray-500'>لا توجد تقييمات مطابقة</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAssessments.map((assessment) => (
                          <TableRow key={assessment.id}>
                            <TableCell className='font-medium'>
                              {assessment.childName}
                            </TableCell>
                            <TableCell>{assessment.childAge} سنة</TableCell>
                            <TableCell>
                              <div className='flex items-center'>
                                <MapPin className='w-3 h-3 ml-1 text-gray-400' />
                                {assessment.governorate}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant='outline'>
                                {assessment.prediction}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className='flex items-center space-x-1 space-x-reverse'>
                                <div
                                  className={`w-3 h-3 rounded-full ${getSeverityColor(assessment.severity)}`}
                                />
                                <span>{assessment.severity}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(assessment.status)}>
                                {assessment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{assessment.assessmentDate}</TableCell>
                            <TableCell>
                              <div className='flex space-x-2 space-x-reverse'>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => handleViewDetails(assessment)}
                                >
                                  <Eye className='w-4 h-4' />
                                </Button>
                                <Link href={`/predict?edit=${assessment.id}`}>
                                  <Button variant='ghost' size='sm'>
                                    <Edit className='w-4 h-4' />
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className='mt-4 text-sm text-gray-500'>
                  عرض {filteredAssessments.length} من {totalAssessments} تقييم
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='patients'>
            {/* Patients Tab - uses real API data */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between'>
                <div>
                  <CardTitle>قائمة المرضى</CardTitle>
                  <CardDescription>إدارة ملفات المرضى ومتابعة حالاتهم</CardDescription>
                </div>
                <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className='w-4 h-4 ml-2' />
                      إضافة مريض جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='sm:max-w-[500px]'>
                    <DialogHeader>
                      <DialogTitle>إضافة مريض جديد</DialogTitle>
                      <DialogDescription>
                        أدخل معلومات المريض الجديد لتسجيله في النظام
                      </DialogDescription>
                    </DialogHeader>
                    <div className='grid gap-4 py-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='patientName'>اسم الطفل</Label>
                          <Input
                            id='patientName'
                            value={newPatient.name}
                            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                            placeholder='اسم الطفل'
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='patientAge'>العمر (سنوات)</Label>
                          <Input
                            id='patientAge'
                            type='number'
                            value={newPatient.age}
                            onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                            placeholder='العمر'
                          />
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='parentName'>اسم الوالد</Label>
                        <Input
                          id='parentName'
                          value={newPatient.parentName}
                          onChange={(e) => setNewPatient({ ...newPatient, parentName: e.target.value })}
                          placeholder='اسم الوالد'
                        />
                      </div>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='governorate'>المحافظة</Label>
                          <Select
                            value={newPatient.governorate}
                            onValueChange={(value) => setNewPatient({ ...newPatient, governorate: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='اختر المحافظة' />
                            </SelectTrigger>
                            <SelectContent>
                              {governorates.map((gov) => (
                                <SelectItem key={gov} value={gov}>
                                  {gov}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='district'>المديرية</Label>
                          <Input
                            id='district'
                            value={newPatient.district}
                            onChange={(e) => setNewPatient({ ...newPatient, district: e.target.value })}
                            placeholder='المديرية'
                          />
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='phone'>رقم الهاتف</Label>
                        <Input
                          id='phone'
                          type='tel'
                          value={newPatient.phoneNumber}
                          onChange={(e) => setNewPatient({ ...newPatient, phoneNumber: e.target.value })}
                          placeholder='رقم الهاتف'
                        />
                      </div>
                    </div>
                    <div className='flex justify-end space-x-2 space-x-reverse'>
                      <Button variant='outline' onClick={() => setIsAddPatientOpen(false)}>
                        إلغاء
                      </Button>
                      <Button onClick={handleAddPatient}>إضافة</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم المريض</TableHead>
                        <TableHead>العمر</TableHead>
                        <TableHead>المحافظة</TableHead>
                        <TableHead>التقييمات</TableHead>
                        <TableHead>آخر تقييم</TableHead>
                        <TableHead>مستوى الخطورة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className='text-center py-8'>
                            <AlertCircle className='w-12 h-12 text-gray-400 mx-auto mb-2' />
                            <p className='text-gray-500'>لا توجد بيانات مرضى</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        patients.map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className='font-medium'>{patient.name}</TableCell>
                            <TableCell>{patient.age} سنة</TableCell>
                            <TableCell>
                              <div className='flex items-center'>
                                <MapPin className='w-3 h-3 ml-1 text-gray-400' />
                                {patient.governorate}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant='secondary'>{patient.assessmentCount}</Badge>
                            </TableCell>
                            <TableCell>{patient.lastAssessment}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  patient.riskLevel === 'عالي'
                                    ? 'bg-red-500'
                                    : patient.riskLevel === 'متوسط'
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }
                              >
                                {patient.riskLevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className='flex space-x-2 space-x-reverse'>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => {
                                    const assessment = assessments.find(a =>
                                      a.childName === patient.name
                                    );
                                    if (assessment) handleViewDetails(assessment);
                                  }}
                                >
                                  <Eye className='w-4 h-4' />
                                </Button>
                                <Button variant='ghost' size='sm'>
                                  <FileText className='w-4 h-4' />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='reports'>
            {/* Reports Tab */}
            <div className='space-y-6'>
              <Card>
                <CardHeader>
                  <CardTitle>التقارير والإحصائيات</CardTitle>
                  <CardDescription>عرض التقارير التفصيلية لحالات سوء التغذية</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-lg'>توزيع الحالات حسب الدرجة</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='space-y-4'>
                          <div>
                            <div className='flex justify-between mb-1'>
                              <span>شديد</span>
                              <span>{severeCases} حالات</span>
                            </div>
                            <Progress value={(severeCases / totalAssessments) * 100} className='h-2' />
                          </div>
                          <div>
                            <div className='flex justify-between mb-1'>
                              <span>متوسط</span>
                              <span>{moderateCases} حالات</span>
                            </div>
                            <Progress value={(moderateCases / totalAssessments) * 100} className='h-2' />
                          </div>
                          <div>
                            <div className='flex justify-between mb-1'>
                              <span>منخفض</span>
                              <span>{totalAssessments - severeCases - moderateCases} حالات</span>
                            </div>
                            <Progress
                              value={((totalAssessments - severeCases - moderateCases) / totalAssessments) * 100}
                              className='h-2'
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-lg'>حالات حسب المحافظة</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='space-y-3'>
                          {governorates.map((gov) => {
                            const count = stats?.byGovernorate?.[gov] ?? assessments.filter((a) => a.governorate === gov).length;
                            return (
                              <div key={gov} className='flex justify-between items-center border-b pb-2 last:border-0'>
                                <span>{gov}</span>
                                <Badge variant='outline'>{count} حالة</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className='mt-6 flex flex-wrap gap-4 justify-center'>
                    <Button variant='outline'>
                      <Download className='w-4 h-4 ml-2' />
                      تصدير تقرير PDF
                    </Button>
                    <Button variant='outline'>
                      <Download className='w-4 h-4 ml-2' />
                      تصدير إكسل
                    </Button>
                    <Button variant='outline'>
                      <Download className='w-4 h-4 ml-2' />
                      تصدير CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      {/* View Details Dialog */}
      <Dialog open={isViewDetailOpen} onOpenChange={setIsViewDetailOpen}>
        <DialogContent className='sm:max-w-[600px]'>
          {selectedAssessment && (
            <>
              <DialogHeader>
                <DialogTitle>تفاصيل التقييم</DialogTitle>
                <DialogDescription>معلومات شاملة عن حالة الطفل</DialogDescription>
              </DialogHeader>
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-sm text-gray-500'>اسم الطفل</Label>
                    <p className='font-medium'>{selectedAssessment.childName}</p>
                  </div>
                  <div>
                    <Label className='text-sm text-gray-500'>العمر</Label>
                    <p className='font-medium'>{selectedAssessment.childAge} سنة</p>
                  </div>
                  <div>
                    <Label className='text-sm text-gray-500'>الجنس</Label>
                    <p className='font-medium'>{selectedAssessment.gender}</p>
                  </div>
                  <div>
                    <Label className='text-sm text-gray-500'>المحافظة</Label>
                    <p className='font-medium'>
                      {selectedAssessment.governorate} - {selectedAssessment.district}
                    </p>
                  </div>
                </div>
                <div className='border-t pt-4'>
                  <h4 className='font-semibold mb-3'>القياسات الجسدية</h4>
                  <div className='grid grid-cols-3 gap-4'>
                    <div className='text-center p-3 bg-gray-50 rounded-lg'>
                      <p className='text-sm text-gray-500'>الطول</p>
                      <p className='text-xl font-bold text-blue-600'>{selectedAssessment.height} سم</p>
                    </div>
                    <div className='text-center p-3 bg-gray-50 rounded-lg'>
                      <p className='text-sm text-gray-500'>الوزن</p>
                      <p className='text-xl font-bold text-green-600'>{selectedAssessment.weight} كغ</p>
                    </div>
                    <div className='text-center p-3 bg-gray-50 rounded-lg'>
                      <p className='text-sm text-gray-500'>محيط العضد (MUAC)</p>
                      <p className='text-xl font-bold text-purple-600'>{selectedAssessment.muac} سم</p>
                    </div>
                  </div>
                </div>
                {selectedAssessment.zScore && (
                  <div className='border-t pt-4'>
                    <h4 className='font-semibold mb-3'>مؤشرات التغذية (z-scores)</h4>
                    <div className='grid grid-cols-3 gap-4'>
                      {selectedAssessment.haz !== undefined && (
                        <div className='text-center p-3 bg-blue-50 rounded-lg'>
                          <p className='text-sm text-gray-500'>HAZ (الطول/العمر)</p>
                          <p className='text-lg font-bold text-blue-600'>{selectedAssessment.haz.toFixed(2)}</p>
                        </div>
                      )}
                      {selectedAssessment.waz !== undefined && (
                        <div className='text-center p-3 bg-green-50 rounded-lg'>
                          <p className='text-sm text-gray-500'>WAZ (الوزن/العمر)</p>
                          <p className='text-lg font-bold text-green-600'>{selectedAssessment.waz.toFixed(2)}</p>
                        </div>
                      )}
                      {selectedAssessment.wfl !== undefined && (
                        <div className='text-center p-3 bg-purple-50 rounded-lg'>
                          <p className='text-sm text-gray-500'>WFL (الوزن/الطول)</p>
                          <p className='text-lg font-bold text-purple-600'>{selectedAssessment.wfl.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className='border-t pt-4'>
                  <h4 className='font-semibold mb-3'>نتائج التقييم</h4>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <Label className='text-sm text-gray-500'>التشخيص</Label>
                      <Badge className='mt-1'>{selectedAssessment.prediction}</Badge>
                    </div>
                    <div>
                      <Label className='text-sm text-gray-500'>درجة الشدة</Label>
                      <div className='flex items-center mt-1 space-x-2 space-x-reverse'>
                        <div
                          className={`w-4 h-4 rounded-full ${getSeverityColor(selectedAssessment.severity)}`}
                        />
                        <span>{selectedAssessment.severity}</span>
                      </div>
                    </div>
                    <div>
                      <Label className='text-sm text-gray-500'>الحالة</Label>
                      <Badge className={`mt-1 ${getStatusColor(selectedAssessment.status)}`}>
                        {selectedAssessment.status}
                      </Badge>
                    </div>
                    <div>
                      <Label className='text-sm text-gray-500'>مقيم من</Label>
                      <p className='font-medium mt-1'>{selectedAssessment.assessedBy}</p>
                    </div>
                  </div>
                </div>
                {selectedAssessment.followUpDate && (
                  <div className='border-t pt-4'>
                    <div className='flex items-center space-x-2 space-x-reverse bg-yellow-50 p-3 rounded-lg'>
                      <Calendar className='w-5 h-5 text-yellow-600' />
                      <div>
                        <p className='font-medium text-yellow-800'>موعد المتابعة</p>
                        <p className='text-sm text-yellow-600'>{selectedAssessment.followUpDate}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className='flex justify-between mt-6'>
                <Button variant='destructive' onClick={() => setIsDeleteDialogOpen(true)}>
                  <Trash2 className='w-4 h-4 ml-2' />
                  حذف
                </Button>
                <div className='flex space-x-2 space-x-reverse'>
                  <Button variant='outline' onClick={() => setIsViewDetailOpen(false)}>
                    إغلاق
                  </Button>
                  <Link href={`/predict?edit=${selectedAssessment.id}`}>
                    <Button>
                      <Edit className='w-4 h-4 ml-2' />
                      تعديل
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف هذا التقييم نهائياً من النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HealthWorkerDashboard;
