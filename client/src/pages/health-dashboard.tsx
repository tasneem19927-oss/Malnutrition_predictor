import { useState, useEffect } from 'react';
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
  CheckCircle,
  AlertTriangle,
  LogOut,
  BarChart3,
  MapPin,
  Phone,
  Calendar,
  Edit,
  Trash2,
  Eye,
  Download,
  Filter,
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

// Types
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

const HealthWorkerDashboard = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isViewDetailOpen, setIsViewDetailOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<ChildAssessment | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // New patient form state
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: 'male',
    governorate: '',
    district: '',
    phoneNumber: '',
    parentName: '',
  });

  // Mock data for assessments
  const mockAssessments: ChildAssessment[] = [
    {
      id: '1',
      childName: 'أحمد محمد',
      childAge: 2,
      gender: 'ذكر',
      governorate: 'تعز',
      district: 'التعزية',
      height: 85,
      weight: 9.2,
      muac: 11.5,
      prediction: 'سوء تغذية حاد',
      severity: 'شديد',
      status: 'تحت المتابعة',
      assessedBy: 'د. فاطمة',
      assessmentDate: '2025-01-10',
      followUpDate: '2025-01-24',
    },
    {
      id: '2',
      childName: 'مريم علي',
      childAge: 3,
      gender: 'أنثى',
      governorate: 'عدن',
      district: 'المنصورة',
      height: 92,
      weight: 12.5,
      muac: 13.0,
      prediction: 'سوء تغذية معتدل',
      severity: 'متوسط',
      status: 'مكتمل',
      assessedBy: 'د. فاطمة',
      assessmentDate: '2025-01-08',
    },
    {
      id: '3',
      childName: 'خالد حسن',
      childAge: 1,
      gender: 'ذكر',
      governorate: 'الحديدة',
      district: 'الزبير',
      height: 72,
      weight: 7.8,
      muac: 10.5,
      prediction: 'سوء تغذية حاد',
      severity: 'شديد',
      status: 'جديد',
      assessedBy: 'د. فاطمة',
      assessmentDate: '2025-01-12',
      followUpDate: '2025-01-19',
    },
    {
      id: '4',
      childName: 'فاطمة سعيد',
      childAge: 4,
      gender: 'أنثى',
      governorate: 'إب',
      district: 'السدة',
      height: 100,
      weight: 14.0,
      muac: 12.5,
      prediction: 'سوء تغذية معتدل',
      severity: 'متوسط',
      status: 'تحت المتابعة',
      assessedBy: 'د. فاطمة',
      assessmentDate: '2025-01-05',
      followUpDate: '2025-01-19',
    },
    {
      id: '5',
      childName: 'عمر يوسف',
      childAge: 2,
      gender: 'ذكر',
      governorate: 'صنعاء',
      district: 'شعوب',
      height: 86,
      weight: 11.0,
      muac: 13.5,
      prediction: 'معدل طبيعي',
      severity: 'منخفض',
      status: 'مكتمل',
      assessedBy: 'د. فاطمة',
      assessmentDate: '2025-01-11',
    },
  ];

  const governorates = ['تعز', 'عدن', 'الحديدة', 'إب', 'صنعاء', 'صعدة', 'حجة', 'تعز'];
  
  // Filter assessments
  const filteredAssessments = mockAssessments.filter((assessment) => {
    const matchesSearch = assessment.childName.includes(searchQuery);
    const matchesGovernorate =
      selectedGovernorate === 'all' || assessment.governorate === selectedGovernorate;
    const matchesSeverity =
      selectedSeverity === 'all' || assessment.severity === selectedSeverity;
    const matchesStatus =
      selectedStatus === 'all' || assessment.status === selectedStatus;
    return matchesSearch && matchesGovernorate && matchesSeverity && matchesStatus;
  });

  // Calculate statistics
  const totalAssessments = mockAssessments.length;
  const severeCases = mockAssessments.filter((a) => a.severity === 'شديد').length;
  const moderateCases = mockAssessments.filter((a) => a.severity === 'متوسط').length;
  const followUpNeeded = mockAssessments.filter((a) => a.status === 'تحت المتابعة').length;
  const newAssessments = mockAssessments.filter((a) => a.status === 'جديد').length;

  // Severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'شديد':
        return 'bg-red-500';
      case 'متوسط':
        return 'bg-yellow-500';
      case 'منخفض':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'جديد':
        return 'bg-blue-500';
      case 'تحت المتابعة':
        return 'bg-yellow-500';
      case 'مكتمل':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Handle view details
  const handleViewDetails = (assessment: ChildAssessment) => {
    setSelectedAssessment(assessment);
    setIsViewDetailOpen(true);
  };

  // Handle add new patient
  const handleAddPatient = () => {
    toast({
      title: 'تمت الإضافة',
      description: 'تم تسجيل المريض الجديد بنجاح',
    });
    setIsAddPatientOpen(false);
    setNewPatient({
      name: '',
      age: '',
      gender: 'male',
      governorate: '',
      district: '',
      phoneNumber: '',
      parentName: '',
    });
    queryClient.invalidateQueries({ queryKey: ['assessments'] });
  };

  // Handle delete assessment
  const handleDeleteAssessment = () => {
    toast({
      title: 'تم الحذف',
      description: 'تم حذف التقييم بنجاح',
      variant: 'destructive',
    });
    setIsDeleteDialogOpen(false);
    setIsViewDetailOpen(false);
  };
  
  return (
    <div className='min-h-screen bg-gray-50' dir='rtl'>
      {/* Header */}
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            <div className='flex items-center space-x-4 space-x-reverse'>
              <h1 className='text-2xl font-bold text-gray-900'>
                لوحة العامل الصحي
              </h1>
              <Badge variant='secondary' className='bg-blue-100 text-blue-800'>
                {user?.role === 'health_worker' ? 'عامل صحي' : 'طبيب'}
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
                      {filteredAssessments.length === 0 ? (
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
            {/* Patients Tab */}
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
                            onChange={(e) =>
                              setNewPatient({ ...newPatient, name: e.target.value })
                            }
                            placeholder='اسم الطفل'
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='patientAge'>العمر (سنوات)</Label>
                          <Input
                            id='patientAge'
                            type='number'
                            value={newPatient.age}
                            onChange={(e) =>
                              setNewPatient({ ...newPatient, age: e.target.value })
                            }
                            placeholder='العمر'
                          />
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='parentName'>اسم الوال</Label>
                        <Input
                          id='parentName'
                          value={newPatient.parentName}
                          onChange={(e) =>
                            setNewPatient({ ...newPatient, parentName: e.target.value })
                          }
                          placeholder='اسم الوال'
                        />
                      </div>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='governorate'>المحافظة</Label>
                          <Select
                            value={newPatient.governorate}
                            onValueChange={(value) =>
                              setNewPatient({ ...newPatient, governorate: value })
                            }
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
                            onChange={(e) =>
                              setNewPatient({ ...newPatient, district: e.target.value })
                            }
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
                          onChange={(e) =>
                            setNewPatient({ ...newPatient, phoneNumber: e.target.value })
                          }
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
                      {/* Mock patient data */}
                      {[
                        {
                          id: '1',
                          name: 'أحمد محمد',
                          age: 2,
                          governorate: 'تعز',
                          assessmentCount: 3,
                          lastAssessment: '2025-01-10',
                          riskLevel: 'عالي',
                        },
                        {
                          id: '2',
                          name: 'مريم علي',
                          age: 3,
                          governorate: 'عدن',
                          assessmentCount: 5,
                          lastAssessment: '2025-01-08',
                          riskLevel: 'متوسط',
                        },
                        {
                          id: '3',
                          name: 'خالد حسن',
                          age: 1,
                          governorate: 'الحديدة',
                          assessmentCount: 1,
                          lastAssessment: '2025-01-12',
                          riskLevel: 'عالي',
                        },
                      ].map((patient) => (
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
                                onClick={() => handleViewDetails(mockAssessments[0])}
                              >
                                <Eye className='w-4 h-4' />
                              </Button>
                              <Button variant='ghost' size='sm'>
                                <FileText className='w-4 h-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
                            const count = mockAssessments.filter((a) => a.governorate === gov).length;
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
