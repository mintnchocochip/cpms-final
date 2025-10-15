import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAllProjects, updateProject, deleteProject } from "../api.js";
import Navbar from "../Components/UniversalNavbar";

import {
  Users,
  Download,
  Filter,
  Search,
  Building2,
  GraduationCap,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  BookOpen,
  Award,
  CalendarDays,
  Settings,
  ChevronDown,
  ChevronRight,
  Database,
  Grid3X3,
  BarChart3,
  Edit,
  Trash2,
  Save,
  Plus,
  Star,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const extractReviewEntries = (reviews) => {
  if (!reviews) return [];
  if (reviews instanceof Map) {
    return Array.from(reviews.values());
  }
  if (typeof reviews === "object") {
    return Object.values(reviews);
  }
  return [];
};

const studentHasPresentAttendance = (student) => {
  if (!student) return false;
  return extractReviewEntries(student.reviews).some(
    (review) => review?.attendance?.value === true
  );
};

const projectHasPresentStudent = (project) => {
  if (!project || !Array.isArray(project.students) || project.students.length === 0) {
    return false;
  }
  return project.students.some(studentHasPresentAttendance);
};


const AdminProjectManagement = () => {
  const navigate = useNavigate();
  // Hardcoded department options for edit modal
const DEPARTMENT_OPTIONS = [
  'BTech', 'MIS(Mtech Integrated)','MIA(Mtech Integrated)','MCA','MCA 2nd Year','MCS','MCB','MAI(Machine Learning)'
,'MAI(Data Science)','MCS'];

  
  // Core state
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminContext, setAdminContext] = useState(null);
  
  // Filter states
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [bestProjectFilter, setBestProjectFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  
  // UI states
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjectData, setEditingProjectData] = useState(null);
  
  const [notification, setNotification] = useState({
    isVisible: false,
    type: "",
    title: "",
    message: "",
  });

const exportToBulkTemplate = (projects) => {
  if (!projects || projects.length === 0) {
    alert("No projects data available to export.");
    return;
  }

  // Excel columns matching your desired format + panel column as a single string
  const columns = [
    'Project Name',
    'Guide Faculty Employee ID', 
    'School',
    'Department',
    'Specialization',
    'Type',
    'Student Name 1',
    'Student RegNo 1', 
    'Student Email 1',
    'Student Name 2',
    'Student RegNo 2',
    'Student Email 2', 
    'Student Name 3',
    'Student RegNo 3',
    'Student Email 3',
    'Panel' // Single string, e.g. 50392 Dr. Syed Ibrahim S P & 52343 Dr. Dinakaran M
  ];

  const rows = projects.map(project => {
    // Get guide faculty employee ID
    const guideEmployeeId = project.guideFaculty?.employeeId || 
                           project.guide?.employeeId || 
                           '';

    // Get project specialization/domain
    const specialization = project.specialization || 
                          project.domain || 
                          project.guideFaculty?.specialization?.[0] || 
                          '';

    // Prepare student data (up to 3 students horizontally)
    const students = project.students || [];

    // Panel example: 50392 Dr. Syed Ibrahim S P & 52343 Dr. Dinakaran M
    const panel = project.panel || {};
    let panelString = '';
    if (Array.isArray(panel.members) && panel.members.length > 0) {
      panelString = panel.members
        .map(m => `${m.employeeId ? m.employeeId : ''} ${m.name ? m.name : ''}`.trim())
        .filter(s => s)
        .join(' & ');
    }

    const row = {
      'Project Name': project.name || '',
      'Guide Faculty Employee ID': guideEmployeeId,
      'School': project.school || '',
      'Department': project.department || '', // allow to be empty
      'Specialization': specialization,
      'Type': project.type || '',
      'Student Name 1': students[0]?.name || '',
      'Student RegNo 1': students[0]?.regNo || '', 
      'Student Email 1': students[0]?.emailId || students[0]?.email || '',
      'Student Name 2': students[1]?.name || '',
      'Student RegNo 2': students[1]?.regNo || '',
      'Student Email 2': students[1]?.emailId || students[1]?.email || '',
      'Student Name 3': students[2]?.name || '',
      'Student RegNo 3': students[2]?.regNo || '',
      'Student Email 3': students[2]?.emailId || students[2]?.email || '',
      'Panel': panelString // the key new field!
    };

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  worksheet['!cols'] = Array(columns.length).fill({ wch: 25 });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ProjectsTemplate');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  
  const fileName = `Projects_Bulk_Template_PanelStrings_${new Date().toISOString().slice(0,10)}.xlsx`;
  saveAs(blob, fileName);
};




  // Show notification function
  const showNotification = useCallback((type, title, message, duration = 4000) => {
    setNotification({
      isVisible: true,
      type,
      title,
      message,
    });

    setTimeout(() => {
      setNotification(prev => ({ ...prev, isVisible: false }));
    }, duration);
  }, []);

  // Hide notification function
  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Check for admin context
  useEffect(() => {
    const savedAdminContext = sessionStorage.getItem("adminContext");
    if (!savedAdminContext) {
      navigate("/admin/school-selection");
      return;
    }
    
    try {
      const parsedContext = JSON.parse(savedAdminContext);
      
      if (parsedContext.skipped) {
        setAdminContext({ school: null, department: null, skipped: true });
      } else if (parsedContext.school && parsedContext.department) {
        setAdminContext(parsedContext);
      } else {
        navigate("/admin/school-selection");
      }
    } catch (error) {
      console.error("Failed to parse admin context:", error);
      navigate("/admin/school-selection");
    }
  }, [navigate]);

  // Fetch projects data
// Fetch projects data
const fetchProjects = useCallback(async () => {
  if (!adminContext) return;
  
  try {
    setLoading(true);
    
    const params = new URLSearchParams();
    
    // Add filters based on context only (no auto-filtering on selections)
    if (!adminContext.skipped) {
      if (adminContext.school) params.append('school', adminContext.school);
      if (adminContext.department) params.append('department', adminContext.department);
    }
    
    const response = await getAllProjects(params);
    
    if (response?.data?.data) {
      setProjects(response.data.data);
      showNotification("success", "Data Loaded", `Successfully loaded ${response.data.data.length} projects`);
    } else {
      setProjects([]);
      showNotification("error", "No Data", "No projects found matching the criteria");
    }
    
  } catch (error) {
    console.error("Error fetching projects:", error);
    setProjects([]);
    showNotification("error", "Fetch Failed", "Failed to load project data. Please try again.");
  } finally {
    setLoading(false);
  }
}, [adminContext, showNotification]); // Removed selectedSchool, selectedDepartment dependencies


useEffect(() => {
  if (adminContext) {
    fetchProjects();
  }
}, [adminContext, fetchProjects]); // Removed selectedSchool, selectedDepartment

// Apply filters manually
const applyFilters = useCallback(async () => {
  if (!adminContext) return;
  
  try {
    setLoading(true);
    
    const params = new URLSearchParams();
    
    // Add filters based on context
    if (!adminContext.skipped) {
      if (adminContext.school) params.append('school', adminContext.school);
      if (adminContext.department) params.append('department', adminContext.department);
    }
    
    // Add manual filter selections only when applying
    if (selectedSchool && selectedSchool !== adminContext.school) {
      params.set('school', selectedSchool);
    }
    if (selectedDepartment && selectedDepartment !== adminContext.department) {
      params.set('department', selectedDepartment);
    }
    
    const response = await getAllProjects(params);
    
    if (response?.data?.data) {
      setProjects(response.data.data);
      showNotification("success", "Filters Applied", `Successfully loaded ${response.data.data.length} projects with filters`);
    } else {
      setProjects([]);
      showNotification("error", "No Data", "No projects found matching the criteria");
    }
    
  } catch (error) {
    console.error("Error applying filters:", error);
    setProjects([]);
    showNotification("error", "Filter Failed", "Failed to apply filters. Please try again.");
  } finally {
    setLoading(false);
  }
}, [adminContext, selectedSchool, selectedDepartment, showNotification]);

  // Handle context change - redirect to school selection
  const handleChangeSchoolDepartment = useCallback(() => {
    sessionStorage.removeItem("adminContext");
    sessionStorage.setItem('adminReturnPath', '/admin/project-management');
    navigate("/admin/school-selection");
  }, [navigate]);

  // Get unique schools and departments from projects
  const availableSchools = useMemo(() => {
    const schools = [...new Set(projects.map(p => p.school).filter(Boolean))];
    return schools.sort();
  }, [projects]);

  const availableDepartments = useMemo(() => {
    const deps = [...new Set(projects.map(p => p.department).filter(Boolean))];
    return deps.sort();
  }, [projects]);

  // Type options for the select element
  const typeOptions = ['Software', 'Hardware'];

  // Helper function to normalize type for backend
  const normalizeType = (type) => {
    if (!type) return '';
    const displayMap = {
      'Software': 'software',
      'Hardware': 'hardware'
    };
    return displayMap[type] || type.toLowerCase().trim();
  };

  // Helper function to display type for frontend
  const displayType = (type) => {
    if (!type) return '';
    const backendMap = {
      'software': 'Software',
      'hardware': 'Hardware'
    };
    return backendMap[type.toLowerCase()] || type;
  };

  // Filter projects based on search and filters
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.name?.toLowerCase().includes(query) ||
        project.guideFaculty?.name?.toLowerCase().includes(query) ||
        project.school?.toLowerCase().includes(query) ||
        project.department?.toLowerCase().includes(query) ||
        project.students?.some(student => 
          student.name?.toLowerCase().includes(query) ||
          student.regNo?.toLowerCase().includes(query)
        )
      );
    }

    // School filter
    if (selectedSchool) {
      filtered = filtered.filter(project => project.school === selectedSchool);
    }

    // Department filter
    if (selectedDepartment) {
      filtered = filtered.filter(project => project.department === selectedDepartment);
    }

    // Best Project filter
    if (bestProjectFilter) {
      if (bestProjectFilter === "best") {
        filtered = filtered.filter(project => project.bestProject === true);
      } else if (bestProjectFilter === "normal") {
        filtered = filtered.filter(project => !project.bestProject);
      }
    }

    if (attendanceFilter === "no-present") {
      filtered = filtered.filter(project => !projectHasPresentStudent(project));
    } else if (attendanceFilter === "has-present") {
      filtered = filtered.filter(project => projectHasPresentStudent(project));
    }

    return filtered;
  }, [projects, searchQuery, selectedSchool, selectedDepartment, bestProjectFilter, attendanceFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalProjects = filteredProjects.length;
    const totalStudents = filteredProjects.reduce((sum, project) => sum + (project.students?.length || 0), 0);
    const projectsWithPanels = filteredProjects.filter(p => p.panel).length;
    const projectsWithGuides = filteredProjects.filter(p => p.guideFaculty).length;
    const bestProjects = filteredProjects.filter(p => p.bestProject).length;
    const projectsWithoutPresentStudents = filteredProjects.filter(project => !projectHasPresentStudent(project)).length;
    
    return {
      totalProjects,
      totalStudents,
      projectsWithPanels,
      projectsWithGuides,
      bestProjects,
      projectsWithoutPresentStudents
    };
  }, [filteredProjects]);

  // Toggle project expansion
  const toggleProjectExpanded = useCallback((projectId) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  }, []);

  // Handle delete project
  const handleDeleteProject = useCallback(async (projectId) => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }
    
    try {
      await deleteProject(projectId);
      await fetchProjects();
      showNotification("success", "Project Deleted", "Project has been successfully deleted");
    } catch (error) {
      console.error("Error deleting project:", error);
      showNotification("error", "Delete Failed", "Failed to delete project. Please try again.");
    }
  }, [fetchProjects, showNotification]);

  // Edit project handler to show modal
  const handleEditProject = useCallback((project) => {
    if (!project || !project._id) {
      showNotification("error", "Invalid Project", "Project data is invalid or missing ID");
      return;
    }
    
    // Ensure type is in display format for the modal
    setEditingProjectData({
      ...project,
      type: displayType(project.type)
    });
    setShowEditModal(true);
  }, [showNotification]);

  // Save edited project function
  const handleSaveProject = useCallback(async (editedProject) => {
    if (!editedProject || !editedProject._id) {
      showNotification("error", "Invalid Project", "Project data is invalid or missing ID");
      return;
    }

    try {
      setLoading(true);

      // Prepare update payload with normalized type
      const updatePayload = {
        projectUpdates: {
          name: editedProject.name,
          school: editedProject.school,
          department: editedProject.department,
          specialization: editedProject.specialization,
          type: normalizeType(editedProject.type) // Normalize for backend
        },
        studentUpdates: (editedProject.students || []).map(student => ({
          studentId: student._id,
          reviews: student.reviews || {},
          pptApproved: student.pptApproved || { approved: false, locked: false }
        })),
        ...(editedProject.pptApproved && { pptApproved: editedProject.pptApproved })
      };

      console.log("🔄 Updating project:", editedProject.name);

      const response = await updateProject(editedProject._id, updatePayload);
      
      if (response?.data?.success) {
        showNotification(
          "success", 
          "Project Updated", 
          `Successfully updated "${editedProject.name}"`
        );
        
        // Close modal and refresh data
        setShowEditModal(false);
        setEditingProjectData(null);
        await fetchProjects();
        
      } else {
        throw new Error(response?.data?.message || "Update failed");
      }

    } catch (error) {
      console.error("❌ Error updating project:", error);
      showNotification(
        "error", 
        "Update Failed", 
        error.response?.data?.message || error.message || "Failed to update project"
      );
    } finally {
      setLoading(false);
    }
  }, [updateProject, fetchProjects, showNotification]);

  // Cancel edit function
  const handleCancelEdit = useCallback(() => {
    setEditingProjectData(null);
    setShowEditModal(false);
  }, []);

  // Enhanced Download Excel function
  const downloadExcel = useCallback(() => {
    try {
      // Prepare detailed data for Excel
      const excelData = filteredProjects.map(project => {
        const row = {
          'Project Name': project.name || '',
          'School': project.school || '',
          'Department': project.department || '',
          'Specialization': project.specialization || '',
          'Type': displayType(project.type) || '',
          'Best Project': project.bestProject ? '🏆 YES' : 'No', // ✅ NEW: Best project column
          'Guide Faculty': project.guideFaculty?.name || '',
          'Guide Employee ID': project.guideFaculty?.employeeId || '',
          'Guide Email': project.guideFaculty?.emailId || '',
          'Panel Assigned': project.panel ? 'Yes' : 'No',
          'Student Count': project.students?.length || 0,
          'Students': project.students?.map(s => `${s.name} (${s.regNo})`).join('; ') || '',
          'Attendance Status': projectHasPresentStudent(project) ? 'Has Present Student' : 'No Present Students',
        };

        // Add panel details if available
        if (project.panel && project.panel.members) {
          row['Panel Members'] = project.panel.members.map(m => m.name).join('; ');
        }

        return row;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = [];
      const headers = Object.keys(excelData[0] || {});
      headers.forEach((header, index) => {
        const maxLength = Math.max(
          header.length,
          ...excelData.map(row => String(row[header] || '').length)
        );
        colWidths[index] = { width: Math.min(maxLength + 2, 50) };
      });
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Project_Management_Export");

      // Generate filename with timestamp and context
      const timestamp = new Date().toISOString().split('T')[0];
      const contextStr = adminContext.skipped 
        ? 'All_Schools_Departments' 
        : `${adminContext.school}_${adminContext.department}`.replace(/\s+/g, '_');
      const filename = `Project_Management_${contextStr}_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      showNotification("success", "Download Complete", `Excel file downloaded: ${filename} (${filteredProjects.length} projects)`);
    } catch (error) {
      console.error("Excel download error:", error);
      showNotification("error", "Download Failed", "Failed to download Excel file. Please try again.");
    }
  }, [filteredProjects, adminContext, showNotification, displayType]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pt-16 sm:pt-20 pl-4 sm:pl-24 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-12 max-w-sm sm:max-w-md mx-auto text-center">
            <div className="relative mb-6 sm:mb-8">
              <div className="animate-spin rounded-full h-16 w-16 sm:h-20 sm:w-20 border-4 border-slate-200 border-t-blue-600 mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Database className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800 mb-3">Loading Project Database</h3>
            <p className="text-sm sm:text-base text-slate-600">Retrieving project records and details...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 sm:pt-20 pl-4 sm:pl-24 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
        
        {/* Page Header with Context */}
        <div className="mb-6 sm:mb-8 mx-4 sm:mx-8 bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 sm:px-8 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <FileSpreadsheet className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold text-white">Project Database Management</h1>
                  <p className="text-indigo-100 mt-1 text-sm sm:text-base">Comprehensive project records and management</p>
                </div>
              </div>
              
              {adminContext && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="text-left sm:text-right">
                      <div className="text-white/90 text-xs sm:text-sm">Current Programme</div>
                      <div className="text-white font-semibold text-sm sm:text-base">
                        {adminContext.skipped ? 'All Schools & Departments' : `${adminContext.school} - ${adminContext.department}`}
                      </div>
                    </div>
                    <button
                      onClick={handleChangeSchoolDepartment}
                      className="bg-white/20 hover:bg-white/30 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-200 font-medium text-sm sm:text-base w-full sm:w-auto"
                    >
                      Change Programme
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="mx-4 sm:mx-8 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
            {/* Total Projects */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Projects</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {stats.totalProjects.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <BookOpen className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>

            {/* Total Students */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-xs sm:text-sm font-medium">Total Students</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {stats.totalStudents.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>

            {/* Panel Assigned */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs sm:text-sm font-medium">Panel Assigned</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {stats.projectsWithPanels.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <Award className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>

            {/* With Guides */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs sm:text-sm font-medium">With Guides</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {stats.projectsWithGuides.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>

            {/* Best Projects */}
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-xs sm:text-sm font-medium">Best Projects</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {stats.bestProjects.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <Star className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-rose-100 text-xs sm:text-sm font-medium">No Present Students</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">
                    {stats.projectsWithoutPresentStudents.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters Panel */}
        <div className="mx-4 sm:mx-8 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-8 gap-4">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-slate-800">Search & Filter Controls</h2>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 space-x-0 sm:space-x-4 w-full sm:w-auto">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium text-sm sm:text-base w-full sm:w-auto"
                >
                  <Grid3X3 className="h-4 w-4" />
                  <span>Advanced Filters</span>
                  {showFilters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
       {/* ✅ UPDATED: Export Buttons Section */}
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-8 gap-4">
 
  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 space-x-0 sm:space-x-4 w-full sm:w-auto">
  
    
    {/* ✅ UPDATED: Enhanced Export Buttons */}
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <button
        onClick={downloadExcel}
        disabled={filteredProjects.length === 0}
        className="flex items-center space-x-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-medium disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg text-sm sm:text-base w-full sm:w-auto"
        title={`Export ${filteredProjects.length} projects as detailed Excel report`}
      >
        <Download className="h-4 w-4" />
        <span>Export Excel ({filteredProjects.length})</span>
      </button>

      {/* ✅ NEW: Bulk Template Export Button */}
      <button
        onClick={() => exportToBulkTemplate(filteredProjects)}
        disabled={filteredProjects.length === 0}
        className="flex items-center space-x-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-medium disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg text-sm sm:text-base w-full sm:w-auto"
        title={`Export ${filteredProjects.length} projects in bulk template format with all student details and panel data`}
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span>Bulk Template ({filteredProjects.length})</span>
      </button>
    </div>
  </div>
</div>

              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4 sm:mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search by project name, guide faculty, students, or departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2 sm:py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-sm sm:text-base text-slate-700 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                </button>
              )}
            </div>

{/* Advanced Filters */}
{showFilters && (
  <div className="border-t border-slate-200 pt-4 sm:pt-6">
    <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-4 sm:mb-6">
      
      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Best Project Filter</label>
        <select
          value={bestProjectFilter}
          onChange={(e) => setBestProjectFilter(e.target.value)}
          className="w-full p-2 sm:p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all text-sm sm:text-base"
        >
          <option value="">All Projects</option>
          <option value="best">🏆 Best Projects Only</option>
          <option value="normal">Regular Projects Only</option>
        </select>
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Attendance Filter</label>
        <select
          value={attendanceFilter}
          onChange={(e) => setAttendanceFilter(e.target.value)}
          className="w-full p-2 sm:p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all text-sm sm:text-base"
        >
          <option value="">All Attendance States</option>
          <option value="no-present">🚨 No Students Marked Present</option>
          <option value="has-present">✅ At Least One Student Present</option>
        </select>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 space-x-0 sm:space-x-4">
      <button
        onClick={() => {
          setSearchQuery("");
          setSelectedSchool("");
          setSelectedDepartment("");
          setBestProjectFilter("");
          setAttendanceFilter("");
        }}
        className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-all duration-200 text-sm sm:text-base w-full sm:w-auto"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Clear All Filters</span>
      </button>
      
      <button
        onClick={applyFilters}
        className="flex items-center space-x-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg text-sm sm:text-base w-full sm:w-auto"
      >
        <Filter className="h-4 w-4" />
        <span>Apply Filters</span>
      </button>
    </div>
  </div>
)}

          </div>
        </div>

        {/* Projects Data Display */}
        <div className="mx-4 sm:mx-8 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl shadow-lg">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12 sm:py-20 px-4">
                <div className="mx-auto w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-6 sm:mb-8">
                  <FileSpreadsheet className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-slate-600 mb-3">No Projects Found</h3>
                <p className="text-sm sm:text-base text-slate-500 max-w-sm sm:max-w-md mx-auto">
                  No projects match your current search and filter criteria. Try adjusting your filters to find the records you're looking for.
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-8 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                      <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800">
                      Project Records ({filteredProjects.length.toLocaleString()})
                    </h2>
                  </div>
                  <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                      onClick={() => setExpandedProjects(new Set(filteredProjects.map(p => p._id)))}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all w-full sm:w-auto"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Expand All</span>
                    </button>
                    <button
                      onClick={() => setExpandedProjects(new Set())}
                      className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all w-full sm:w-auto"
                    >
                      <EyeOff className="h-4 w-4" />
                      <span>Collapse All</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredProjects.map((project) => {
                    const isExpanded = expandedProjects.has(project._id);
                    const hasPresentStudent = projectHasPresentStudent(project);
                    
                    return (
                      <div
                        key={project._id}
                        className="border border-slate-200 rounded-xl bg-gradient-to-r from-white to-slate-50 hover:shadow-lg transition-all duration-300"
                      >
                        <div
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleProjectExpanded(project._id)}
                        >
                          <div className="flex items-center space-x-3 sm:space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
                              {isExpanded ? (
                                <ChevronDown className="text-blue-600 h-5 w-5 sm:h-6 sm:w-6" />
                              ) : (
                                <ChevronRight className="text-blue-600 h-5 w-5 sm:h-6 sm:w-6" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-base sm:text-xl text-slate-800 mb-1">
                                {project.name}
                              </h4>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-slate-600">
                                <span className="flex items-center space-x-1">
                                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span>{project.students?.length || 0} students</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span>{project.guideFaculty?.name || 'No Guide'}</span>
                                </span>
                                {project.school && <span>{project.school}</span>}
                                {project.department && <span>{project.department}</span>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 mt-3 sm:mt-0">
                            {/* Best Project Badge */}
                            {project.bestProject && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold flex items-center space-x-1">
                                <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
                                <span>🏆 BEST PROJECT</span>
                              </span>
                            )}
                            
                            {project.panel && (
                              <span className="bg-emerald-100 text-emerald-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold flex items-center space-x-1">
                                <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Panel Assigned</span>
                              </span>
                            )}
                            {!hasPresentStudent && (
                              <span className="bg-rose-100 text-rose-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold flex items-center space-x-1">
                                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>No Attendance Marked</span>
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProject(project);
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project._id);
                              }}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-200 p-4 sm:p-6 bg-slate-50">
                            {/* Project Details */}
                            <div className="mb-6 sm:mb-8">
                              <h5 className="font-bold text-base sm:text-xl mb-4 sm:mb-6 text-slate-800 flex items-center space-x-2">
                                <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                                <span>Project Details</span>
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                                  <h6 className="font-bold text-base sm:text-lg text-slate-800 mb-3">Basic Information</h6>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Project Name:</span>
                                      <p className="text-slate-600">{project.name}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs sm:text-sm font-semibold text-slate-700">School:</span>
                                      <p className="text-slate-600">{project.school}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Department:</span>
                                      <p className="text-slate-600">{project.department}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Specialization:</span>
                                      <p className="text-slate-600">{project.specialization || 'Not specified'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Type:</span>
                                      <p className="text-slate-600">{displayType(project.type) || 'Not specified'}</p>
                                    </div>
                                    {/* Best Project Status in Details */}
                                    <div>
                                      <span className="text-xs sm:text-sm font-semibold text-slate-700">Best Project:</span>
                                      <div className="flex items-center space-x-2 mt-1">
                                        {project.bestProject ? (
                                          <>
                                            <Star className="h-4 w-4 text-yellow-600 fill-current" />
                                            <span className="text-yellow-600 font-bold">🏆 YES - Marked as Best Project</span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-slate-500">No</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                                  <h6 className="font-bold text-base sm:text-lg text-slate-800 mb-3">Guide Faculty</h6>
                                  {project.guideFaculty ? (
                                    <div className="space-y-2">
                                      <div>
                                        <span className="text-xs sm:text-sm font-semibold text-slate-700">Name:</span>
                                        <p className="text-slate-600">{project.guideFaculty.name}</p>
                                      </div>
                                      <div>
                                        <span className="text-xs sm:text-sm font-semibold text-slate-700">Employee ID:</span>
                                        <p className="text-slate-600">{project.guideFaculty.employeeId}</p>
                                      </div>
                                      <div>
                                        <span className="text-xs sm:text-sm font-semibold text-slate-700">Email:</span>
                                        <p className="text-slate-600">{project.guideFaculty.emailId}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-slate-500">No guide faculty assigned</p>
                                  )}
                                </div>

                                <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                                  <h6 className="font-bold text-base sm:text-lg text-slate-800 mb-3">Panel Assignment</h6>
                                  {project.panel ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2 text-emerald-600">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-xs sm:text-sm font-semibold">Panel Assigned</span>
                                      </div>
                                      {project.panel.members && project.panel.members.length > 0 && (
                                        <div>
                                          <span className="text-xs sm:text-sm font-semibold text-slate-700">Panel Members:</span>
                                          <div className="mt-1">
                                            {project.panel.members.map((member, index) => (
                                              <p key={index} className="text-slate-600 text-sm">
                                                {member.name} ({member.employeeId})
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-2 text-amber-600">
                                      <Clock className="h-4 w-4" />
                                      <span className="text-xs sm:text-sm font-semibold">No Panel Assigned</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Students Section */}
                            <div>
                              <h5 className="font-bold text-base sm:text-xl mb-4 sm:mb-6 text-slate-800 flex items-center space-x-2">
                                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                                <span>Students ({project.students?.length || 0})</span>
                              </h5>
                              {project.students && project.students.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                  {project.students.map((student, index) => (
                                    <div key={student._id} className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                                      <div className="flex justify-between items-start mb-3">
                                        <h6 className="font-bold text-base sm:text-lg text-slate-800">{student.name}</h6>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                                          #{index + 1}
                                        </span>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <div>
                                          <span className="text-xs sm:text-sm font-semibold text-slate-700">Reg No:</span>
                                          <p className="text-slate-600">{student.regNo}</p>
                                        </div>
                                        <div>
                                          <span className="text-xs sm:text-sm font-semibold text-slate-700">Email:</span>
                                          <p className="text-slate-600">{student.emailId}</p>
                                        </div>
                                        <div>
                                          <span className="text-xs sm:text-sm font-semibold text-slate-700">Reviews:</span>
                                          <p className="text-slate-600">
                                            {student.reviews ? Object.keys(student.reviews).length : 0} completed
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-xs sm:text-sm font-semibold text-slate-700">PPT Status:</span>
                                          <div className="flex items-center space-x-2 mt-1">
                                            {student.pptApproved?.approved ? (
                                              <>
                                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                                                <span className="text-emerald-600 text-sm">Approved</span>
                                              </>
                                            ) : (
                                              <>
                                                <Clock className="h-4 w-4 text-amber-600" />
                                                <span className="text-amber-600 text-sm">Pending</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-6">
                                  <div className="flex items-center space-x-3 text-amber-800">
                                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                                    <div>
                                      <span className="font-bold block text-sm sm:text-base">No Students</span>
                                      <span className="text-xs sm:text-sm text-amber-700">This project has no students assigned.</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Project Modal */}
        {showEditModal && editingProjectData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
                    <Edit className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Edit Project</h2>
                    <p className="text-slate-600 mt-1">Update project information</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Project Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editingProjectData.name || ''}
                    onChange={(e) => setEditingProjectData(prev => ({
                      ...prev,
                      name: e.target.value
                    }))}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-slate-700"
                    placeholder="Enter project name"
                    disabled={loading}
                  />
                </div>

                {/* School */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    School
                  </label>
                  <select
                    value={editingProjectData.school || ''}
                    onChange={(e) => setEditingProjectData(prev => ({
                      ...prev,
                      school: e.target.value
                    }))}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-slate-700"
                    disabled={loading}
                  >
                    <option value="">Select School</option>
                    {availableSchools.map(school => (
                      <option key={school} value={school}>{school}</option>
                    ))}
                  </select>
                </div>

               
          {/* Department */}
<div>
  <label className="block text-sm font-semibold text-slate-700 mb-3">
    Department
  </label>
  <select
    value={editingProjectData.department || ''}
    onChange={(e) => setEditingProjectData(prev => ({
      ...prev,
      department: e.target.value
    }))}
    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-slate-700"
    disabled={loading}
  >
    <option value="">Select Department</option>
    {DEPARTMENT_OPTIONS.map(dept => (
      <option key={dept} value={dept}>{dept}</option>
    ))}
  </select>
</div>


                {/* Specialization */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={editingProjectData.specialization || ''}
                    onChange={(e) => setEditingProjectData(prev => ({
                      ...prev,
                      specialization: e.target.value
                    }))}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-slate-700"
                    placeholder="Enter specialization"
                    disabled={loading}
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Type
                  </label>
                  <select
                    value={editingProjectData.type || ''}
                    onChange={(e) => setEditingProjectData(prev => ({
                      ...prev,
                      type: e.target.value
                    }))}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-slate-700"
                    disabled={loading}
                  >
                    <option value="">Select Type</option>
                    {typeOptions.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Students Info (Read-only display) */}
                {editingProjectData.students && editingProjectData.students.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Students ({editingProjectData.students.length})
                    </label>
                    <div className="bg-slate-50 rounded-xl p-4 max-h-32 overflow-y-auto">
                      {editingProjectData.students.map((student, index) => (
                        <div key={student._id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-b-0">
                          <div>
                            <span className="font-medium text-slate-700">{student.name}</span>
                            <span className="text-slate-500 ml-2">({student.regNo})</span>
                          </div>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                            #{index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  onClick={() => handleSaveProject(editingProjectData)}
                  disabled={loading || !editingProjectData.name?.trim() || !editingProjectData.name}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Notification */}
        {notification.isVisible && (
          <div className="fixed top-20 sm:top-24 right-4 sm:right-8 z-50 max-w-xs sm:max-w-md w-full">
            <div className={`transform transition-all duration-500 ease-out ${
              notification.isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}>
              <div className={`rounded-xl shadow-2xl border-l-4 p-4 sm:p-6 ${
                notification.type === "success" 
                  ? "bg-emerald-50 border-emerald-400" 
                  : "bg-red-50 border-red-400"
              }`}>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 ${
                    notification.type === "success" ? "text-emerald-500" : "text-red-500"
                  }`}>
                    {notification.type === "success" ? (
                      <div className="relative">
                        <div className="animate-ping absolute inline-flex h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-400 opacity-75"></div>
                        <CheckCircle className="relative inline-flex h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                    ) : (
                      <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <h3 className={`text-xs sm:text-sm font-bold ${
                      notification.type === "success" ? "text-emerald-800" : "text-red-800"
                    }`}>
                      {notification.title}
                    </h3>
                    <p className={`mt-1 text-xs sm:text-sm ${
                      notification.type === "success" ? "text-emerald-700" : "text-red-700"
                    }`}>
                      {notification.message}
                    </p>
                  </div>
                  <button
                    onClick={hideNotification}
                    className={`flex-shrink-0 ml-3 ${
                      notification.type === "success" 
                        ? "text-emerald-400 hover:text-emerald-600" 
                        : "text-red-400 hover:text-red-600"
                    } transition-colors`}
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </>
  );
};

export default AdminProjectManagement;
