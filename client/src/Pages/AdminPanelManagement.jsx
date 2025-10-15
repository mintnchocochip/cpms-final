import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  getAllPanels,
  getAllPanelProjects,
  getAllGuideProjects,
  getAllProjects,
  getMarkingSchema,
  createPanelManual,
  deletePanel,
  assignPanelToProject,
  autoAssignPanelsToProjects,
  autoCreatePanelManual,
} from "../api";


import TeamPopup from "../Components/TeamPopup";
import ConfirmPopup from "../Components/ConfirmDialog";
import Navbar from "../Components/UniversalNavbar";
import ManualPanelCreation from "../Components/ManualPanelCreation";
import AutoCreatePanel from "../Components/AutoCreatePanel";
import AutoAssignPanel from "../Components/AutoAssignPanel";
import PanelStatsCard from "../Components/PanelStatsCard";
import PanelCard from "../Components/PanelCard";

import {
  Users,
  Plus,
  Zap,
  Bot,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  Database,
  Search,
  BarChart3,
  RefreshCw,
  Download,
  MapPin,
  ClipboardCheck,
  ClipboardX,
} from "lucide-react";

const normalizeReviewCollection = (reviews) => {
  if (!reviews) return {};
  if (reviews instanceof Map) {
    return Object.fromEntries(reviews);
  }
  if (typeof reviews === "object") {
    return { ...reviews };
  }
  return {};
};

const normalizeMarksCollection = (marks) => {
  if (!marks) return {};
  if (marks instanceof Map) {
    return Object.fromEntries(marks);
  }
  if (typeof marks === "object") {
    return { ...marks };
  }
  return {};
};

const reviewHasMeaningfulData = (review) => {
  if (!review || typeof review !== "object") return false;

  if (review.locked) return true;

  const attendanceValue = review.attendance?.value;
  if (attendanceValue === true) return true;

  if (review.comments && review.comments.trim().length > 0) return true;

  const marks = normalizeMarksCollection(review.marks);
  for (const value of Object.values(marks)) {
    if (value === "PAT") return true;
    if (typeof value === "number" && !Number.isNaN(value) && value !== 0) {
      return true;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric) && numeric !== 0) return true;
      if (trimmed.toUpperCase() === "PAT") return true;
    }
  }

  return false;
};

const resolveSchoolDepartment = (project, panel) => {
  const school = project?.school || (Array.isArray(panel?.school) ? panel.school[0] : panel?.school);
  const department = project?.department || (Array.isArray(panel?.department) ? panel.department[0] : panel?.department);
  if (!school || !department) {
    return [null, null];
  }
  return [school, department];
};

const schemaKeyFor = (school, department) => {
  if (!school || !department) return null;
  return `${school}|||${department}`;
};

const computeProjectMarkInfo = (project, panel, schemaCache) => {
  const baseSummary = {
    reviewNames: [],
    totalStudents: Array.isArray(project?.students) ? project.students.length : 0,
    studentsWithAnyMarks: 0,
    studentsFullyMarked: 0,
    hasAnyMarked: false,
    isFullyMarked: false,
    status: "none",
  };

  if (!project || !Array.isArray(project.students) || project.students.length === 0) {
    return baseSummary;
  }

  const [school, department] = resolveSchoolDepartment(project, panel);
  const key = schemaKeyFor(school, department);
  const schema = key ? schemaCache.get(key) : null;
  const panelReviews = (schema?.reviews || []).filter((review) => review.facultyType === "panel");

  if (!schema || panelReviews.length === 0) {
    return {
      ...baseSummary,
      status: "no-schema",
    };
  }

  const reviewNames = panelReviews.map((review) => review.reviewName);
  let studentsWithAnyMarks = 0;
  let studentsFullyMarked = 0;

  project.students.forEach((student) => {
    const reviews = normalizeReviewCollection(student.reviews);

    const hasAny = reviewNames.some((reviewName) => reviewHasMeaningfulData(reviews[reviewName]));
    const isComplete = reviewNames.every((reviewName) => reviewHasMeaningfulData(reviews[reviewName]));

    if (hasAny) studentsWithAnyMarks += 1;
    if (isComplete) studentsFullyMarked += 1;
  });

  const totalStudents = project.students.length;
  const isFullyMarked = totalStudents > 0 && studentsFullyMarked === totalStudents;
  const hasAnyMarked = studentsWithAnyMarks > 0;

  return {
    reviewNames,
    totalStudents,
    studentsWithAnyMarks,
    studentsFullyMarked,
    hasAnyMarked,
    isFullyMarked,
    status: isFullyMarked ? "full" : hasAnyMarked ? "partial" : "none",
  };
};

const computePanelMarkSummary = (panel, schemaCache) => {
  const enrichedTeams = panel.teams.map((team) => {
    const markStatus = computeProjectMarkInfo(team.full, panel, schemaCache);
    return {
      ...team,
      markStatus,
    };
  });

  const totalProjects = enrichedTeams.length;
  const fullyMarkedProjects = enrichedTeams.filter((team) => team.markStatus.isFullyMarked).length;
  const projectsWithAnyMarks = enrichedTeams.filter((team) => team.markStatus.hasAnyMarked).length;
  const partialProjects = Math.max(projectsWithAnyMarks - fullyMarkedProjects, 0);
  const unmarkedProjects = Math.max(totalProjects - projectsWithAnyMarks, 0);

  let status = "none";
  if (totalProjects === 0) {
    status = "no-projects";
  } else if (fullyMarkedProjects === totalProjects) {
    status = "all";
  } else if (projectsWithAnyMarks === 0) {
    status = "none";
  } else {
    status = "partial";
  }

  return {
    teams: enrichedTeams,
    summary: {
      totalProjects,
      fullyMarkedProjects,
      partialProjects,
      unmarkedProjects,
      status,
    },
  };
};

const AdminPanelManagement = () => {
  const navigate = useNavigate();
  const [facultyList, setFacultyList] = useState([]);
  const [panels, setPanels] = useState([]);
  const [modalTeam, setModalTeam] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState({
    type: "",
    panelId: null,
    teamId: null,
  });

  // ✅ SIMPLIFIED: Modal states (removed complex popup objects)
  const [showManualCreateModal, setShowManualCreateModal] = useState(false);
  const [showAutoCreateModal, setShowAutoCreateModal] = useState(false);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);

  // Notification state
  const [notification, setNotification] = useState({
    isVisible: false,
    type: "",
    title: "",
    message: "",
    icon: null,
  });

  const [expandedPanel, setExpandedPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [unassignedTeams, setUnassignedTeams] = useState([]);
  const [allGuideProjects, setAllGuideProjects] = useState([]);
  const [adminContext, setAdminContext] = useState(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [panelMarkFilter, setPanelMarkFilter] = useState("");

  // Show notification function
  const showNotification = useCallback((type, title, message, duration = 4000) => {
    setNotification({
      isVisible: true,
      type,
      title,
      message,
      icon: type === "success" ? <CheckCircle className="h-6 w-6" /> : <XCircle className="h-6 w-6" />,
    });

    setTimeout(() => {
      setNotification(prev => ({ ...prev, isVisible: false }));
    }, duration);
  }, []);

  // Hide notification function
  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  }, []);

  // ✅ ENHANCED: Fetch data function with proper employee ID extraction
  const fetchData = useCallback(async () => {
    if (!adminContext) return;
    
    try {
      setLoading(true);
      const { school, department, skipped } = adminContext;

      const apiSchool = skipped ? null : school;
      const apiDepartment = skipped ? null : department;

      const projectParams = new URLSearchParams();
      if (apiSchool) projectParams.append("school", apiSchool);
      if (apiDepartment) projectParams.append("department", apiDepartment);

      const [panelRes, panelProjectsRes, guideProjectsRes, projectRes] = await Promise.all([
        getAllPanels(apiSchool, apiDepartment),
        getAllPanelProjects(apiSchool, apiDepartment),
        getAllGuideProjects(apiSchool, apiDepartment),
        getAllProjects(projectParams),
      ]);

      // Process panels data
      let allPanelsData = [];
      if (panelRes?.data?.success && panelRes.data.data) {
        allPanelsData = panelRes.data.data;
      } else if (panelRes?.data && Array.isArray(panelRes.data)) {
        allPanelsData = panelRes.data;
      } else if (panelRes?.success && panelRes.data) {
        allPanelsData = panelRes.data;
      }

      // Process panel projects data
      let panelProjectData = [];
      if (panelProjectsRes?.data?.success && panelProjectsRes.data.data) {
        panelProjectData = panelProjectsRes.data.data;
      } else if (panelProjectsRes?.data && Array.isArray(panelProjectsRes.data)) {
        panelProjectData = panelProjectsRes.data;
      } else if (panelProjectsRes?.success && panelProjectsRes.data) {
        panelProjectData = panelProjectsRes.data;
      }

      const detailedProjects = projectRes?.data?.data || [];
      const detailedProjectsMap = new Map(
        detailedProjects.map((project) => [project._id?.toString?.() || String(project._id), project])
      );

      // Create panel teams map
      const panelTeamsMap = new Map();
      panelProjectData.forEach((p) => {
        const teams = (p.projects || []).map((project) => {
          const projectId = project._id?.toString?.() || String(project._id);
          const detailedProject = detailedProjectsMap.get(projectId) || project;

          return {
            id: projectId,
            name: project.name,
            domain: project.domain || project.specialization || "N/A",
            members: (project.students || []).map((s) => s.name || s.regNo),
            full: detailedProject,
          };
        });
        panelTeamsMap.set(p.panelId, teams);
      });

      // ✅ ENHANCED: Format panels with faculty employee IDs directly from API response
      // ✅ ENHANCED: Format panels with faculty employee IDs directly from API response
      const formattedPanels = allPanelsData.map((panel) => ({
  panelId: panel._id,
  facultyIds: (panel.members || []).map(m => m._id).filter(Boolean),
  facultyNames: (panel.members || []).map(m => m.name).filter(Boolean),
  facultyEmployeeIds: (panel.members || []).map(m => m.employeeId).filter(Boolean), // ✅ NEW: Direct from API
  venue: panel.venue, // ✅ Include venue data
  department: panel.department || "Unknown",
  school: panel.school || "Unknown",
  teams: panelTeamsMap.get(panel._id) || [],
}));


      console.log('✅ Formatted panels with employee IDs:', formattedPanels);

      const schemaKeys = new Set();
      formattedPanels.forEach((panel) => {
        (panel.teams || []).forEach((team) => {
          const [teamSchool, teamDepartment] = resolveSchoolDepartment(team.full, panel);
          const key = schemaKeyFor(teamSchool, teamDepartment);
          if (key) {
            schemaKeys.add(key);
          }
        });
      });

      const schemaEntries = await Promise.all(
        Array.from(schemaKeys).map(async (key) => {
          const [schemaSchool, schemaDepartment] = key.split("|||");
          try {
            const schemaResponse = await getMarkingSchema(schemaSchool, schemaDepartment);
            const schemaData = schemaResponse?.schema || schemaResponse?.data?.schema || null;
            return [key, schemaData];
          } catch (schemaError) {
            console.error(`Error fetching marking schema for ${schemaSchool}-${schemaDepartment}:`, schemaError);
            return [key, null];
          }
        })
      );

      const schemaCache = new Map(schemaEntries);

      const panelsWithMarkStatus = formattedPanels.map((panel) => {
        const { teams: enrichedTeams, summary } = computePanelMarkSummary(panel, schemaCache);
        return {
          ...panel,
          teams: enrichedTeams,
          markSummary: summary,
        };
      });

      setPanels(panelsWithMarkStatus);

      // Process guide projects
      let guideProjectData = [];
      if (guideProjectsRes?.data?.success && guideProjectsRes.data.data) {
        guideProjectData = guideProjectsRes.data.data;
      } else if (guideProjectsRes?.data && Array.isArray(guideProjectsRes.data)) {
        guideProjectData = guideProjectsRes.data;
      } else if (guideProjectsRes?.success && guideProjectsRes.data) {
        guideProjectData = guideProjectsRes.data;
      }

      const guideProjectRelationships = [];
      (guideProjectData || []).forEach((facultyObj) => {
        const facultyId = facultyObj.faculty?._id;
        (facultyObj.guidedProjects || []).forEach((project) => {
          guideProjectRelationships.push({
            projectId: project._id,
            guideId: facultyId,
            guideName: facultyObj.faculty?.name,
            department: project.department,
          });
        });
      });
      setAllGuideProjects(guideProjectRelationships);

      // Process unassigned teams
      const allProjectsFromGuides = (guideProjectData || []).flatMap(
        (facultyObj) => facultyObj.guidedProjects || []
      );
      const uniqueProjects = allProjectsFromGuides.filter(
        (project, index, self) => index === self.findIndex((p) => p._id === project._id)
      );
      const unassigned = uniqueProjects.filter((project) => project.panel === null);
      setUnassignedTeams(unassigned);

    } catch (err) {
      console.error("Error fetching data:", err);
      setPanels([]);
      setFacultyList([]);
      setUnassignedTeams([]);
      setAllGuideProjects([]);
      showNotification("error", "Fetch Failed", "Failed to load panel data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [adminContext, showNotification]);

  // ✅ FIXED: Get employee IDs directly from panel data (no complex mapping needed)
  const usedFacultyIds = useMemo(() => {
    const assignedEmployeeIds = new Set();
    
    console.log('=== CALCULATING USED FACULTY EMPLOYEE IDS ===');
    console.log('Panels:', panels.length);
    
    panels.forEach((panel, index) => {
      console.log(`Panel ${index + 1}:`, {
        panelId: panel.panelId,
        facultyNames: panel.facultyNames,
        facultyEmployeeIds: panel.facultyEmployeeIds
      });
      
      // ✅ DIRECT: Use employee IDs from panel data (no mapping required)
      if (panel.facultyEmployeeIds && Array.isArray(panel.facultyEmployeeIds)) {
        panel.facultyEmployeeIds.forEach(empId => {
          if (empId) {
            assignedEmployeeIds.add(empId.toString());
            console.log(`✅ Added employee ID: ${empId}`);
          }
        });
      }
    });
    
    const result = Array.from(assignedEmployeeIds);
    console.log('Final used employee IDs:', result);
    console.log('=== END USED EMPLOYEE ID CALCULATION ===');
    
    return result;
  }, [panels]);

  // ✅ SIMPLIFIED: Filter available faculty by employee ID
  const availableFaculty = useMemo(() => {
    console.log('=== CALCULATING AVAILABLE FACULTY ===');
    console.log('Total faculty list:', facultyList.length);
    console.log('Used employee IDs:', usedFacultyIds);
    
    const filtered = facultyList.filter(f => {
      if (!f || !f.employeeId) {
        console.log(`❌ Faculty without employee ID: ${f?.name || 'Unknown'}`);
        return false;
      }
      
      const isAssigned = usedFacultyIds.includes(f.employeeId.toString());
      if (isAssigned) {
        console.log(`❌ Excluding assigned faculty: ${f.name} (${f.employeeId})`);
      } else {
        console.log(`✅ Including available faculty: ${f.name} (${f.employeeId})`);
      }
      return !isAssigned;
    });
    
    console.log('Available faculty count:', filtered.length);
    console.log('Available faculty names:', filtered.map(f => `${f.name} (${f.employeeId})`));
    console.log('=== END AVAILABLE FACULTY CALCULATION ===');
    
    return filtered;
  }, [facultyList, usedFacultyIds]);

  // ✅ SIMPLIFIED: Direct employee ID set for Excel filtering
  const assignedEmployeeIds = useMemo(() => {
    return new Set(usedFacultyIds);
  }, [usedFacultyIds]);

  // ✅ COMPLETE FIXED Excel upload handler
  const handleExcelUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showNotification("error", "Invalid File", "Please upload a valid Excel file (.xlsx or .xls)");
      event.target.value = "";
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Validate headers
        const headers = jsonData[0].map(h => h.trim());
        const requiredHeaders = ["Faculty Name", "Emp ID", "Email ID", "Department"];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          showNotification("error", "Invalid Format", `Missing required columns: ${missingHeaders.join(", ")}`);
          event.target.value = "";
          return;
        }

        // Process rows
        const validDepartments = ["BTech", "MTech (integrated)", "MCA"];
        const processedFacultyData = jsonData.slice(1).map((row, index) => {
          const rowObj = {};
          headers.forEach((header, headerIndex) => {
            rowObj[header] = row[headerIndex] || "";
          });
          
          return {
            _id: `temp_${index}_${Date.now()}`,
            name: rowObj["Faculty Name"],
            employeeId: rowObj["Emp ID"].toString(),
            emailId: rowObj["Email ID"],
            department: [rowObj["Department"]],
            school: ["SCOPE"],
            specialization: ["General"],
          };
        }).filter(faculty => 
          faculty.name && 
          faculty.employeeId && 
          faculty.emailId && 
          validDepartments.includes(faculty.department[0])
        );

        if (processedFacultyData.length === 0) {
          showNotification("error", "No Valid Data", "No valid faculty data found in the Excel file");
          event.target.value = "";
          return;
        }

        // ✅ ENHANCED: Better exclusion logic using direct employee ID comparison
        const existingEmployeeIds = facultyList.map(f => f.employeeId?.toString()).filter(Boolean);
        
        console.log('Processing Excel upload:');
        console.log('- Processed faculties:', processedFacultyData.length);
        console.log('- Existing employee IDs:', existingEmployeeIds.length);
        console.log('- Assigned employee IDs:', assignedEmployeeIds.size);

        // Filter out existing AND assigned faculty
        const newFaculty = processedFacultyData.filter(f => {
          const empId = f.employeeId.toString();
          const isExisting = existingEmployeeIds.includes(empId);
          const isAssigned = assignedEmployeeIds.has(empId);
          
          if (isExisting || isAssigned) {
            console.log(`Excluding: ${f.name} (${empId}) - Existing: ${isExisting}, Assigned: ${isAssigned}`);
          }
          
          return !isExisting && !isAssigned;
        });
        
        const duplicateCount = processedFacultyData.filter(f => 
          existingEmployeeIds.includes(f.employeeId.toString())
        ).length;
        
        const assignedCount = processedFacultyData.filter(f => 
          assignedEmployeeIds.has(f.employeeId.toString())
        ).length;

        setFacultyList(prev => [...prev, ...newFaculty]);

        let message = `Successfully processed ${newFaculty.length} faculty records`;
        if (duplicateCount > 0) {
          message += ` (${duplicateCount} duplicates skipped)`;
        }
        if (assignedCount > 0) {
          message += ` (${assignedCount} already in panels skipped)`;
        }

        showNotification("success", "Upload Successful", message);
        event.target.value = "";
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Excel processing error:", error);
      showNotification("error", "Processing Error", "Failed to process Excel file. Please ensure it's valid.");
      event.target.value = "";
    }
  }, [showNotification, facultyList, assignedEmployeeIds]);

  // Demo Excel download
  const handleDemoExcelDownload = useCallback(() => {
    const demoData = [
      ["Faculty Name", "Emp ID", "Email ID", "Department"],
      ["John Doe", "50001", "john.doe@vit.ac.in", "BTech"],
      ["Jane Smith", "50002", "jane.smith@vit.ac.in", "MTech (integrated)"],
      ["Alice Johnson", "500003", "alice.johnson@vit.ac.in", "MCS"],
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(demoData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Faculty Template");
    XLSX.writeFile(workbook, "Faculty_Demo.xlsx");
  }, []);

  // Admin context effect
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

  useEffect(() => {
    if (adminContext) {
      fetchData();
    }
  }, [adminContext, fetchData]);

  // Navigation handler
  const handleChangeSchoolDepartment = useCallback(() => {
    sessionStorage.removeItem("adminContext");
    sessionStorage.setItem('adminReturnPath', '/admin/panel-management');
    navigate("/admin/school-selection");
  }, [navigate]);

  // Conflict checking functions
  const canAssignProjectToPanel = useCallback((projectId, panelFacultyIds) => {
    const projectGuide = allGuideProjects.find((rel) => rel.projectId === projectId);
    if (!projectGuide) return { canAssign: true, reason: "" };

    const hasConflict = panelFacultyIds.includes(projectGuide.guideId);
    if (hasConflict) {
      return {
        canAssign: false,
        reason: `Cannot assign: ${projectGuide.guideName} is the guide for this project`,
      };
    }

    return { canAssign: true, reason: "" };
  }, [allGuideProjects]);

  const getAvailableTeamsForPanel = useCallback((panelFacultyIds) => {
    return unassignedTeams.filter((team) => {
      const check = canAssignProjectToPanel(team._id, panelFacultyIds);
      return check.canAssign;
    });
  }, [unassignedTeams, canAssignProjectToPanel]);

  // ✅ SIMPLIFIED: Panel management handlers
  const handleManualCreatePanel = useCallback(async (payload) => {
    try {
      setLoading(true);
      await createPanelManual(payload);
      setShowManualCreateModal(false);
      await fetchData();
      showNotification("success", "Panel Created!", `New panel created successfully with ${payload.memberEmployeeIds.length} members`);
    } catch (error) {
      console.error("Panel creation error:", error);
      showNotification("error", "Creation Failed", error.response?.data?.message || "Failed to create panel. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchData, showNotification]);

  // ✅ SIMPLIFIED: Success/Error handlers for modals
  const handleSuccess = useCallback((message) => {
    fetchData(); // Refresh data
    showNotification("success", "Success!", message);
  }, [fetchData, showNotification]);

  const handleError = useCallback((message) => {
    showNotification("error", "Error", message);
  }, [showNotification]);

  // ✅ SIMPLIFIED: Modal show handlers
  const handleAutoCreatePanel = useCallback(() => {
    if (isAutoAssigning) {
      showNotification("error", "Operation in Progress", "Cannot start auto panel creation while auto assignment is running.");
      return;
    }
    setShowAutoCreateModal(true);
  }, [isAutoAssigning, showNotification]);

  const handleAutoAssign = useCallback(() => {
    if (isAutoCreating) {
      showNotification("error", "Operation in Progress", "Cannot start auto assignment while auto panel creation is running.");
      return;
    }
    setShowAutoAssignModal(true);
  }, [isAutoCreating, showNotification]);

  const handleManualAssign = useCallback(async (panelId, projectId) => {
    try {
      const panel = panels.find((entry) => entry.panelId === panelId);
      if (!panel) return;

      const conflictCheck = canAssignProjectToPanel(projectId, panel.facultyIds);
      if (!conflictCheck.canAssign) {
        showNotification("error", "Assignment Conflict", conflictCheck.reason);
        return;
      }

      await assignPanelToProject({ panelId: panel.panelId, projectId });
      await fetchData();
      showNotification("success", "Team Assigned!", "Team has been successfully assigned to the panel");
    } catch (error) {
      console.error("Assignment error:", error);
      showNotification("error", "Assignment Failed", "Failed to assign team. Please try again.");
    }
  }, [panels, canAssignProjectToPanel, fetchData, showNotification]);

  const handleConfirmRemove = useCallback(async () => {
    const { type, panelId, teamId } = confirmRemove;
    try {
      if (type === "panel") {
        await deletePanel(panelId);
        showNotification("success", "Panel Deleted!", "Panel has been successfully removed");
      } else if (type === "team") {
        await assignPanelToProject({ panelId: null, projectId: teamId });
        showNotification("success", "Team Removed!", "Team has been successfully unassigned");
      }
      await fetchData();
    } catch (error) {
      console.error("Delete operation error:", error);
      showNotification("error", "Operation Failed", "Failed to complete the operation. Please try again.");
    }
    setConfirmRemove({ type: "", panelId: null, teamId: null });
  }, [confirmRemove, fetchData, showNotification]);

  const filterMatches = useCallback((str) =>
    str &&
    typeof str === "string" &&
    str.toLowerCase().includes(searchQuery.toLowerCase()),
    [searchQuery]
  );

  const filteredPanels = useMemo(() => {
    return panels.filter((panel) => {
      const matchesSearch =
        !searchQuery ||
        panel.facultyNames.some((name) => filterMatches(name)) ||
        panel.teams.some((team) =>
          filterMatches(team.name) ||
          filterMatches(team.domain) ||
          filterMatches(team.full?.school) ||
          filterMatches(team.full?.department) ||
          filterMatches(team.full?.specialization)
        ) ||
        (panel.venue && filterMatches(panel.venue)) ||
        filterMatches(panel.school) ||
        filterMatches(panel.department);

      if (!matchesSearch) {
        return false;
      }

      if (!panelMarkFilter) {
        return true;
      }

      const status = panel.markSummary?.status || "unknown";
      switch (panelMarkFilter) {
        case "all":
          return status === "all";
        case "partial":
          return status === "partial";
        case "none":
          return status === "none";
        case "no-projects":
          return status === "no-projects";
        default:
          return true;
      }
    });
  }, [panels, searchQuery, filterMatches, panelMarkFilter]);

  const markStatusCounts = useMemo(() => {
    return panels.reduce(
      (acc, panel) => {
        const status = panel.markSummary?.status || "unknown";
        if (status === "all") acc.all += 1;
        else if (status === "partial") acc.partial += 1;
        else if (status === "none") acc.none += 1;
        else if (status === "no-projects") acc.noProjects += 1;
        return acc;
      },
      { all: 0, partial: 0, none: 0, noProjects: 0 }
    );
  }, [panels]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pt-20 pl-4 sm:pl-6 md:pl-24 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12 max-w-md mx-auto text-center">
            <div className="relative mb-8">
              <div className="animate-spin rounded-full h-16 w-16 sm:h-20 sm:w-20 border-4 border-slate-200 border-t-blue-600 mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Database className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-3">Loading Panel Management</h3>
            <p className="text-slate-600">Retrieving panel data and team assignments...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="pt-20 pl-4 sm:pl-6 md:pl-24 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
        {/* Page Header */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg mx-4 sm:mx-6 md:mx-8 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-2 sm:p-3 rounded-xl">
                  <Database className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Panel Management</h1>
                  <p className="text-indigo-100 mt-1 text-sm sm:text-base">Manage evaluation panels and team assignments</p>
                </div>
              </div>
              
              {adminContext && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <div className="text-white/90 text-xs sm:text-sm">Current Programme</div>
                      <div className="text-white font-semibold text-sm sm:text-base">
                        {adminContext.skipped ? 'All Schools & Departments' : `${adminContext.school} - ${adminContext.department}`}
                      </div>
                    </div>
                    <button
                      onClick={handleChangeSchoolDepartment}
                      className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all duration-200 font-medium w-full sm:w-auto text-center"
                    >
                      Change Programme
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Statistics using extracted component */}
        <div className="mx-4 sm:mx-6 md:mx-8 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
            <PanelStatsCard
              icon={Users}
              title="Total Faculty"
              value={facultyList.length}
              bgColor="bg-gradient-to-br from-blue-500 to-blue-600"
              iconBg="bg-white/20"
            />
            <PanelStatsCard
              icon={() => <div className="h-6 w-6 sm:h-8 sm:w-8 bg-white/30 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm">P</div>}
              title="Total Panels"
              value={panels.length}
              bgColor="bg-gradient-to-br from-emerald-500 to-emerald-600"
              iconBg="bg-white/20"
            />
            <PanelStatsCard
              icon={CheckCircle}
              title="Assigned Teams"
              value={panels.reduce((sum, panel) => sum + panel.teams.length, 0)}
              bgColor="bg-gradient-to-br from-purple-500 to-purple-600"
              iconBg="bg-white/20"
            />
            <PanelStatsCard
              icon={AlertTriangle}
              title="Unassigned Teams"
              value={unassignedTeams.length}
              bgColor="bg-gradient-to-br from-orange-500 to-orange-600"
              iconBg="bg-white/20"
            />
            <PanelStatsCard
              icon={ClipboardCheck}
              title="Fully Marked Panels"
              value={markStatusCounts.all}
              bgColor="bg-gradient-to-br from-teal-500 to-teal-600"
              iconBg="bg-white/20"
            />
            <PanelStatsCard
              icon={ClipboardX}
              title="Pending Panel Marks"
              value={markStatusCounts.partial + markStatusCounts.none}
              bgColor="bg-gradient-to-br from-rose-500 to-rose-600"
              iconBg="bg-white/20"
            />
          </div>
        </div>

        {/* Controls Panel */}
        <div className="mx-4 sm:mx-6 md:mx-8 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 sm:gap-0">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Panel Creation & Management</h2>
              </div>
              <div className="flex items-center space-x-4 w-full sm:w-auto">
                <button
                  onClick={() => fetchData()}
                  disabled={loading}
                  className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium w-full sm:w-auto justify-center sm:justify-start"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search teams, faculty, or domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-slate-700 placeholder-slate-400 text-base sm:text-lg"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                  Panel Mark Status
                </label>
                <select
                  value={panelMarkFilter}
                  onChange={(e) => setPanelMarkFilter(e.target.value)}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-sm sm:text-base"
                >
                  <option value="">All Panels</option>
                  <option value="all">✅ Fully Marked</option>
                  <option value="partial">⚠️ Partially Marked</option>
                  <option value="none">🚫 No Marks Recorded</option>
                  <option value="no-projects">📂 No Projects Assigned</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setPanelMarkFilter("")}
                  disabled={!panelMarkFilter}
                  className={`w-full sm:w-auto px-4 py-2 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                    panelMarkFilter
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Clear Mark Filter
                </button>
              </div>
            </div>

            {/* Panel Creation Controls */}
            <div className="border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                {/* Manual Create Panel Button */}
                <button
                  onClick={() => setShowManualCreateModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  disabled={availableFaculty.length < 2}
                  title={availableFaculty.length < 2 ? "Need at least 2 available faculty members" : "Create a panel manually by selecting faculty members"}
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  Manual Create
                </button>

                {/* Auto Create Panel Button */}
                <button
                  onClick={handleAutoCreatePanel}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  disabled={isAutoCreating || isAutoAssigning}
                >
                  {isAutoCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                      Auto Create
                    </>
                  )}
                </button>

                {/* Auto Assign Button */}
                <button
                  onClick={handleAutoAssign}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  disabled={isAutoAssigning || isAutoCreating}
                >
                  {isAutoAssigning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
                      Auto Assign
                    </>
                  )}
                </button>

                {/* Faculty Excel Upload */}
                <div className="flex flex-col gap-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    Upload Faculty Excel
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="w-full p-2 sm:p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm sm:text-base file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                {/* Demo Excel Download */}
                <button
                  onClick={handleDemoExcelDownload}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  title="Download a demo Excel file with the correct format"
                >
                  <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                  Demo Excel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Panels using extracted component */}
        <div className="mx-4 sm:mx-6 md:mx-8 mb-8">
          <div className="bg-white rounded-2xl shadow-lg">
            {panels.length === 0 ? (
              <div className="text-center py-16 sm:py-20">
                <div className="mx-auto w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-6 sm:mb-8">
                  <Users className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-600 mb-3">No Panels Found</h3>
                <p className="text-slate-500 max-w-md mx-auto text-sm sm:text-base">
                  {availableFaculty.length < 2 
                    ? "Upload faculty data first, then create panels to get started with team assignments"
                    : "Create panels to get started with team assignments"}
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-6 md:p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                    Panel Records ({filteredPanels.length.toLocaleString()} / {panels.length.toLocaleString()})
                  </h2>
                </div>
                {filteredPanels.length === 0 ? (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 text-center">
                    <p className="text-slate-600 font-medium">No panels match the current search or mark filter.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPanels.map((panel, idx) => {
                      const availableTeamsForPanel = getAvailableTeamsForPanel(panel.facultyIds);
                      const isExpanded = expandedPanel === panel.panelId;

                      return (
                        <PanelCard
                          key={panel.panelId}
                          panel={panel}
                          index={idx}
                          isExpanded={isExpanded}
                          onToggleExpand={() => setExpandedPanel(expandedPanel === panel.panelId ? null : panel.panelId)}
                          onRemovePanel={(panelId) => setConfirmRemove({ type: "panel", panelId })}
                          availableTeams={availableTeamsForPanel}
                          onManualAssign={handleManualAssign}
                          unassignedTeams={unassignedTeams}
                          allGuideProjects={allGuideProjects}
                          onRemoveTeam={(teamId) => setConfirmRemove({ type: "team", teamId })}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ✅ FIXED: Pass availableFaculty instead of full facultyList */}
        <ManualPanelCreation
          isOpen={showManualCreateModal}
          onClose={() => setShowManualCreateModal(false)}
          onSubmit={handleManualCreatePanel}
          facultyList={availableFaculty} // ✅ Only unassigned faculty
          loading={loading}
          adminContext={adminContext}
          usedFacultyIds={usedFacultyIds}
        />

        <AutoCreatePanel
          isOpen={showAutoCreateModal}
          onClose={() => setShowAutoCreateModal(false)}
          facultyList={availableFaculty} // ✅ Only unassigned faculty
          adminContext={adminContext}
          onSuccess={handleSuccess}
          onError={handleError}
          autoCreatePanelManual={autoCreatePanelManual}
          setIsCreating={setIsAutoCreating}
          usedFacultyIds={usedFacultyIds}
        />

        <AutoAssignPanel
          isOpen={showAutoAssignModal}
          onClose={() => setShowAutoAssignModal(false)}
          facultyList={facultyList}
          panelsLength={panels.length}
          onSuccess={handleSuccess}
          onError={handleError}
          autoAssignPanelsToProjects={autoAssignPanelsToProjects}
          setIsAssigning={setIsAutoAssigning}
        />

        {/* Notification */}
        {notification.isVisible && (
          <div className="fixed top-20 sm:top-24 right-4 sm:right-8 z-50 max-w-md w-full px-4 sm:px-0">
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
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
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
                    className={`flex-shrink-0 ml-2 sm:ml-3 ${
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

        {/* Other modals */}
        <TeamPopup team={modalTeam} onClose={() => setModalTeam(null)} />
        <ConfirmPopup
          isOpen={!!confirmRemove.type}
          onClose={() => setConfirmRemove({ type: "", panelId: null, teamId: null })}
          onConfirm={handleConfirmRemove}
          type={confirmRemove.type}
        />
      </div>
    </>
  );
};

export default AdminPanelManagement;
