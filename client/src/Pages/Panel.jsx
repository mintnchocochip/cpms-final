import React, { useState, useEffect, useCallback } from 'react';
import PopupReview from '../Components/PopupReview';
import ReviewTable from '../Components/ReviewTable';
import Navbar from '../Components/UniversalNavbar';
import { ChevronRight, RefreshCw, Users, Calendar, AlertCircle, MapPin } from 'lucide-react';
import { 
  getPanelProjects,
  updateProject,
  createReviewRequest,
  batchCheckRequestStatuses,
} from '../api';

// Normalize student.review and .deadline fields from Mongo Map or raw object to plain object
function normalizeStudentData(student) {
  // --- Normalize reviews ---
  let reviews = {};
  if (student.reviews) {
    if (student.reviews instanceof Map) {
      reviews = Object.fromEntries(student.reviews);
    } else if (typeof student.reviews === 'object') {
      reviews = { ...student.reviews };
    }
  }
  
  // --- Normalize deadline ---
  let deadline = {};
  if (student.deadline) {
    if (student.deadline instanceof Map) {
      deadline = Object.fromEntries(student.deadline);
    } else if (typeof student.deadline === 'object') {
      deadline = { ...student.deadline };
    }
  }
  
  return {
    ...student,
    reviews,
    deadline,
  };
}

// Memoized inner content component to prevent unnecessary re-renders
const PanelContent = React.memo(({ 
  teams, 
  expandedTeam, 
  setExpandedTeam, 
  requestStatuses, 
  getReviewTypes,
  getDeadlines,
  getTeamRequestStatus, 
  isTeamDeadlinePassed,
  isReviewLocked,
  getButtonColor,
  setActivePopup,
  refreshKey,
  getGuidePPTStatus // FIXED: Pass as prop
}) => {
  console.log('🔄 [PanelContent] Rendering inner content with refreshKey:', refreshKey);
  
  return (
    <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Panel Reviews</h2>
        <p className="text-blue-100 mt-1">Manage and conduct panel evaluations</p>
      </div>
      
      {teams.length === 0 ? (
        <div className="p-8 sm:p-12 text-center">
          <div className="bg-gray-50 rounded-2xl p-8 max-w-md mx-auto">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-lg sm:text-xl text-gray-600 mb-2 font-semibold">No Panel Projects</div>
            <p className="text-sm sm:text-base text-gray-500">Projects assigned to you as panel will appear here</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {teams.map(team => {
            // ✅ FIXED: Get review types and deadlines per team like Guide does
            const reviewTypes = getReviewTypes(team.markingSchema);
            const deadlines = getDeadlines(team.markingSchema);
            
            if (!reviewTypes.length) {
              return (
                <div key={team.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-6 m-4 sm:m-6 rounded-r-xl">
                  <div className="flex items-center space-x-3">
                    <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-yellow-800 text-sm sm:text-base">{team.title}</p>
                      <p className="text-xs sm:text-sm text-yellow-700 mt-1">No marking schema configured for this project</p>
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <div key={team.id} className="bg-white hover:bg-gray-50 transition-colors duration-200">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                          className="flex items-center flex-shrink-0 mt-1 p-1 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <ChevronRight className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                            expandedTeam === team.id ? 'rotate-90' : ''
                          }`} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-base sm:text-lg lg:text-xl break-words mb-2">
                            {team.title}
                          </h3>
                          <p className="text-sm sm:text-base text-gray-600 mb-3">{team.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-4 mb-3">
                            <div className="flex items-center gap-2 text-blue-600">
                              <Users className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                {team.students.length} Student{team.students.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            {team.panel?.venue && (
                              <div className="flex items-center gap-2 text-emerald-600">
                                <MapPin className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                  Venue: {team.panel.venue}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Status Information */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                            {reviewTypes.map(reviewType => {
                              const isPassed = isTeamDeadlinePassed(reviewType.key, team.id);
                              const requestStatus = getTeamRequestStatus(team, reviewType.key);
                              const guidePPTStatus = getGuidePPTStatus(team, reviewType.key);
                              
                              return (
                                <div key={reviewType.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                  <span className="font-medium text-gray-700 truncate">
                                    {reviewType.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      isPassed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                      {isPassed ? 'Deadline Passed' : 'Active'}
                                    </span>
                                    
                                    {/* Extension status */}
                                    {requestStatus === 'approved' && (
                                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                                        Extended
                                      </span>
                                    )}
                                    
                                    {/* Pending status */}
                                    {requestStatus === 'pending' && (
                                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                                        Pending
                                      </span>
                                    )}
                                    
                                    {/* Guide PPT Approval Status for PPT-required reviews */}
                                    {reviewType.requiresPPT && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        guidePPTStatus === 'approved'
                                          ? 'bg-green-100 text-green-700'
                                          : guidePPTStatus === 'partial'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : guidePPTStatus === 'not-approved'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {guidePPTStatus === 'approved'
                                          ? 'Guide ✓'
                                          : guidePPTStatus === 'partial'
                                          ? 'Guide ⚠'
                                          : guidePPTStatus === 'not-approved'
                                          ? 'Guide ✗'
                                          : 'Guide ?'
                                        }
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Review Buttons */}
                    <div className="flex flex-wrap gap-3 justify-start lg:justify-end">
                      {reviewTypes.map(reviewType => {
                        const isPassed = isTeamDeadlinePassed(reviewType.key, team.id);
                        const requestStatus = getTeamRequestStatus(team, reviewType.key);
                        return (
                         <button
                            key={reviewType.key}
                            onClick={() => setActivePopup({ 
                              type: reviewType.key, 
                              teamId: team.id,
                              teamTitle: team.title,
                              students: team.students,
                              markingSchema: team.markingSchema // ✅ Pass team's marking schema
                            })}
                            className={`px-4 py-3 text-white text-sm font-medium rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${getButtonColor(reviewType.key)} ${
                              isPassed ? 'opacity-75' : ''
                            } flex items-center gap-2 whitespace-nowrap min-w-0`}
                            title={`${reviewType.components?.length || 0} components${
                              requestStatus === 'approved' ? ' | Extended by Admin' : ''
                            }${isPassed ? ' | DEADLINE PASSED' : ''}`}
                          >
                            <span className="truncate max-w-24 sm:max-w-none">{reviewType.name}</span>
                            {reviewType.requiresPPT && (
                              <span className="text-xs bg-white bg-opacity-30 px-2 py-1 rounded-full flex-shrink-0 font-bold">PPT</span>
                            )}
                            {requestStatus === 'approved' && (
                              <span className="text-xs bg-purple-500 px-2 py-1 rounded-full flex-shrink-0 font-bold">EXT</span>
                            )}
                            {isPassed && (
                              <span className="text-xs bg-red-500 px-2 py-1 rounded-full flex-shrink-0">🔒</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {expandedTeam === team.id && (
                    <div className="mt-6 -mx-4 sm:-mx-6 bg-gray-50 rounded-xl overflow-hidden">
                      <div className="p-4 sm:p-6">
                        <ReviewTable
                          team={team}
                          deadlines={deadlines}
                          requestStatuses={requestStatuses}
                          isDeadlinePassed={(reviewType) => isTeamDeadlinePassed(reviewType, team.id)}
                          isReviewLocked={(student, reviewType) => isReviewLocked(student, reviewType, team.id)}
                          markingSchema={team.markingSchema} // ✅ Pass team's marking schema
                          panelMode={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

const Panel = () => {
  const [teams, setTeams] = useState([]);
  const [activePopup, setActivePopup] = useState(null);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestStatuses, setRequestStatuses] = useState({});
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // FIXED: Moved inside component - Function to get guide PPT approval status
  const getGuidePPTStatus = useCallback((team, reviewType) => {
    if (!team.students || team.students.length === 0) return 'unknown';
    
    // Check if ALL students have guide PPT approval
    const allApproved = team.students.every(student => 
      student.pptApproved?.approved === true
    );
    
    // Check if ANY student has guide PPT approval
    const someApproved = team.students.some(student => 
      student.pptApproved?.approved === true
    );
    
    if (allApproved) return 'approved';
    if (someApproved) return 'partial';
    return 'not-approved';
  }, []);

  // ✅ FIXED: Same as Guide - get review types per team's marking schema
  const getReviewTypes = useCallback((markingSchema) => {
    console.log('🔍 [Panel] Getting review types from schema:', markingSchema);
    if (markingSchema?.reviews) {
      const panelReviews = markingSchema.reviews
        .filter(review => review.facultyType === 'panel')
        .map(review => ({
          key: review.reviewName,
          name: review.displayName || review.reviewName,
          components: review.components || [],
          requiresPPT: review.requiresPPT || false,
          facultyType: review.facultyType
        }));
      console.log('✅ [Panel] Panel reviews found:', panelReviews);
      return panelReviews;
    }
    
    console.log('❌ [Panel] No schema found - returning empty reviews');
    return [];
  }, []);

  // ✅ FIXED: Same as Guide - get deadlines per team's marking schema
  const getDeadlines = useCallback((markingSchema) => {
    console.log('📅 [Panel] Getting deadlines from schema:', markingSchema);
    const deadlineData = {};
    if (markingSchema?.reviews) {
      markingSchema.reviews
        .filter(review => review.facultyType === 'panel')
        .forEach(review => {
          if (review.deadline) {
            deadlineData[review.reviewName] = review.deadline;
          }
        });
    }
    return deadlineData;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ✅ FIXED: Only call getPanelProjects - it should include marking schema per project
      const projectsRes = await getPanelProjects().catch(error => ({ data: { success: false, error: error.message } }));

      let mappedTeams = [];
      
      if (projectsRes.data?.success) {
        const projects = projectsRes.data.data;
        mappedTeams = projects.map(project => ({
          id: project._id,
          title: project.name,
          description: `Panel: ${project.panel?.members?.map(member => member.name).join(', ') || 'N/A'}`,
          students: (project.students || []).map(normalizeStudentData),
          pptApproved: project.pptApproved || { approved: false, locked: false },
          panel: project.panel,
          bestProject: !!project.bestProject,
          markingSchema: project.markingSchema, // ✅ Each team has its own marking schema
        }));
        setTeams(mappedTeams);
        console.log('✅ [Panel] Teams mapped with marking schemas:', mappedTeams.map(t => ({ title: t.title, hasSchema: !!t.markingSchema })));

        // ✅ FIXED: Batch fetch request statuses using per-team marking schemas
        if (mappedTeams.length > 0) {
          const batchRequests = [];
          
          mappedTeams.forEach(team => {
            const reviewTypes = getReviewTypes(team.markingSchema);
            team.students.forEach(student => {
              reviewTypes.forEach(reviewType => {
                batchRequests.push({
                  regNo: student.regNo,
                  reviewType: reviewType.key,
                  facultyType: 'panel',
                });
              });
            });
          });
          
          console.log('🔍 [Panel] Fetching request statuses for', batchRequests.length, 'requests');
          const statuses = await batchCheckRequestStatuses(batchRequests);
          console.log('✅ [Panel] Request statuses received:', statuses);
          setRequestStatuses(statuses || {});
        }
      } else {
        setTeams([]);
      }

    } catch (err) {
      console.error('❌ [Panel] Error fetching data:', err);
      setError('Failed to load panel data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getReviewTypes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      console.log('🔄 [Panel] Starting partial refresh...');
      
      await fetchData();
      setRefreshKey(prev => prev + 1);
      
      console.log('✅ [Panel] Partial refresh completed');
    } catch (err) {
      console.error('❌ [Panel] Error during refresh:', err);
      setError('Failed to refresh panel data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  // ✅ FIXED: Dynamic button colors based on actual review types
  const getButtonColor = useCallback((reviewType) => {
    // ✅ Generate colors based on review type hash for consistency
    const hash = reviewType.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colors = [
      'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
      'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
      'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
      'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
      'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700',
      'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }, []);

  const getTeamRequestStatus = useCallback((team, reviewType) => {
    if (!team) return 'none';
    const statuses = team.students.map(student => {
      const requestKey = `${student.regNo}_${reviewType}`;
      return requestStatuses[requestKey]?.status || 'none';
    });
    if (statuses.includes('pending')) return 'pending';
    if (statuses.includes('approved')) return 'approved';
    return 'none';
  }, [requestStatuses]);

  const isTeamDeadlinePassed = useCallback((reviewType, teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return false;

    // ✅ FIXED: Use team's marking schema for deadlines
    const teamDeadlines = getDeadlines(team.markingSchema);
    if (!teamDeadlines || !teamDeadlines[reviewType]) {
      return false;
    }

    const now = new Date();
    const currentIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const teamRequestStatus = getTeamRequestStatus(team, reviewType);

    if (teamRequestStatus === 'approved') {
      const studentsWithOverride = team.students.filter(s => s.deadline && s.deadline[reviewType]);
      if (studentsWithOverride.length > 0) {
        const latest = studentsWithOverride
          .map(s => {
            try {
              const deadline = new Date(s.deadline[reviewType].to);
              return new Date(deadline.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean)
          .reduce((max, dt) => (max && dt > max ? dt : max), null);
        if (latest) return currentIST > latest;
      }
    }

    const deadline = teamDeadlines[reviewType];
    try {
      if (deadline.from && deadline.to) {
        const toIST = new Date(new Date(deadline.to).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        return currentIST > toIST;
      } else if (typeof deadline === "string" || deadline instanceof Date) {
        const deadlineIST = new Date(new Date(deadline).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        return currentIST > deadlineIST;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, [teams, getDeadlines, getTeamRequestStatus]);

  const isReviewLocked = useCallback((student, reviewType, teamId) => {
    const reviewData = student.reviews && typeof student.reviews.get === 'function'
      ? student.reviews.get(reviewType)
      : student.reviews?.[reviewType];
    if (reviewData?.locked) {
      return true;
    }
    
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const requestStatus = getTeamRequestStatus(team, reviewType);
      if (requestStatus === 'approved') {
        console.log(`🔓 [Panel] Extension approved for ${reviewType} - UNLOCKING`);
        return false;
      }
    }
    
    const deadlinePassed = isTeamDeadlinePassed(reviewType, teamId);
    console.log(`🔒 [Panel] Deadline passed: ${deadlinePassed}, Review type: ${reviewType}`);
    return deadlinePassed;
  }, [isTeamDeadlinePassed, teams, getTeamRequestStatus]);

  const handleReviewSubmit = useCallback(async (teamId, reviewType, reviewData, pptObj, projectObj) => {
    try {
      console.log('=== [PANEL] REVIEW SUBMIT STARTED ===');
      
      const team = teams.find(t => t.id === teamId);
      if (!team) {
        console.error('❌ [PANEL] Team not found for ID:', teamId);
        alert('Team not found! Please refresh and try again.');
        return;
      }

      console.log('✅ [PANEL] Team found:', team.title);
      console.log('📋 [PANEL] Review Type:', reviewType);
      console.log('📋 [PANEL] Raw Review Data from popup:', reviewData);
      console.log('🏆 [PANEL] Project data (best project):', projectObj);

      // ✅ FIXED: Use team's marking schema
      const reviewConfig = team.markingSchema?.reviews?.find(r => r.reviewName === reviewType);
      
      if (!reviewConfig) {
        console.error('❌ [PANEL] Review config not found for type:', reviewType);
        alert('Review configuration not found! Please refresh and try again.');
        return;
      }

      // Process student updates
      const studentUpdates = team.students.map(student => {
        console.log(`🎓 [PANEL] Processing student: ${student.name} (${student.regNo})`);
        
        const studentReviewData = reviewData[student.regNo] || {};
        console.log(`📊 [PANEL] Student review data for ${student.name}:`, studentReviewData);
        
        // Build marks object using component names from schema
        const marks = {};
        if (reviewConfig.components && reviewConfig.components.length > 0) {
          reviewConfig.components.forEach(comp => {
            const markValue = Number(studentReviewData[comp.name]) || 0;
            marks[comp.name] = markValue;
            console.log(`📊 [PANEL] Component ${comp.name}: ${markValue} for ${student.name}`);
          });
        }

        const updateData = {
          studentId: student._id,
          reviews: {
            [reviewType]: {
              marks: marks,
              attendance: studentReviewData.attendance || { value: false, locked: false },
              locked: studentReviewData.locked || false,
              comments: studentReviewData.comments || ''
            }
          }
        };

        if (reviewConfig?.requiresPPT && pptObj?.pptApproved) {
          updateData.pptApproved = pptObj.pptApproved;
        }

        return updateData;
      });

      const projectData = {
        projectUpdates: {},
        studentUpdates: studentUpdates
      };

      if (projectObj?.bestProject !== undefined) {
        projectData.projectUpdates.bestProject = projectObj.bestProject;
        console.log('🏆 [PANEL] Setting PROJECT-LEVEL best project status:', projectObj.bestProject);
      }

      if (reviewConfig?.requiresPPT && pptObj) {
        projectData.pptApproved = pptObj.pptApproved;
      }

      console.log('📤 [PANEL] Final project data:', JSON.stringify(projectData, null, 2));
      
      const response = await updateProject(teamId, projectData);
      console.log('📨 [PANEL] Backend response received:', response);
      
      if (response.data?.success || response.data?.updates) {
        setActivePopup(null);
        
        setTimeout(async () => {
          await handleRefresh();
          
          if (projectObj?.bestProject) {
            alert('🏆 SUCCESS! Panel review submitted and project marked as BEST PROJECT!');
          } else if (response.data?.bestProject === false) {
            alert('Panel review submitted. Project is no longer marked as best project.');
          } else {
            alert('Panel review submitted and saved successfully!');
          }
        }, 300);
        
      } else {
        console.error('❌ [PANEL] Backend response indicates failure:', response.data);
        alert('Review submission failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ [PANEL] Critical error during submission:', error);
      alert(`Error submitting panel review: ${error.message}`);
    }
  }, [teams, handleRefresh]);

  const handleRequestEdit = useCallback(async (teamId, reviewType) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const reason = prompt('Please enter the reason for requesting edit access:', 'Need to correct marks after deadline');
      if (!reason?.trim()) return;

      const requestData = {
        regNo: team.students?.[0]?.regNo,
        reviewType: reviewType,
        reason: reason.trim()
      };

      const response = await createReviewRequest('panel', requestData);
      if (response.success) {
        alert('Edit request submitted successfully!');
        await handleRefresh();
      } else {
        alert(response.message || 'Error submitting request');
      }
    } catch (error) {
      console.error('❌ [Panel] Error submitting edit request:', error);
      alert('Error submitting panel request. Please try again.');
    }
  }, [teams, handleRefresh]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pt-16 sm:pt-20 pl-4 sm:pl-24 min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-12 max-w-sm sm:max-w-md mx-auto text-center">
            <div className="relative mb-6 sm:mb-8">
              <div className="animate-spin rounded-full h-16 w-16 sm:h-20 sm:w-20 border-4 border-slate-200 border-t-blue-600 mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800 mb-3">Loading Panel Data</h3>
            <p className="text-sm sm:text-base text-slate-600">Retrieving student records and academic data...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar userType="faculty" />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-14">
          <div className="lg:ml-64 xl:ml-16 transition-all duration-300">
            <div className="flex items-center justify-center min-h-[80vh] px-4">
              <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-lg">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <div className="text-xl sm:text-2xl text-red-600 mb-4 font-semibold">Error Loading Data</div>
                <p className="text-sm sm:text-base text-gray-600 mb-6">{error}</p>
                <button
                  onClick={fetchData}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-300 transform hover:scale-105"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar userType="faculty" />
      <div className='min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-14'>
        <div className="lg:ml-64 xl:ml-16 transition-all duration-300">
          <div className='p-4 sm:p-6 lg:p-8 xl:p-12 max-w-7xl mx-auto'>
            {/* Header Section */}
            <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4'>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">Panel Dashboard</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">Review and evaluate capstone projects</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-white transition-all duration-300 text-sm sm:text-base font-medium transform hover:scale-105 ${
                  refreshing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
                }`}
                title="Refresh request statuses and data"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
                <span className="sm:hidden">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
            
            {/* Inner content */}
            <PanelContent
              key={refreshKey}
              teams={teams}
              expandedTeam={expandedTeam}
              setExpandedTeam={setExpandedTeam}
              requestStatuses={requestStatuses}
              getReviewTypes={getReviewTypes}
              getDeadlines={getDeadlines}
              getTeamRequestStatus={getTeamRequestStatus}
              isTeamDeadlinePassed={isTeamDeadlinePassed}
              isReviewLocked={isReviewLocked}
              getButtonColor={getButtonColor}
              setActivePopup={setActivePopup}
              refreshKey={refreshKey}
              getGuidePPTStatus={getGuidePPTStatus} // FIXED: Pass as prop
            />
            
            {/* Popup Review Modal */}
            {activePopup && (
              (() => {
                const team = teams.find(t => t.id === activePopup.teamId);
                if (!team) return null;
                
                const isLocked = isTeamDeadlinePassed(activePopup.type, activePopup.teamId);
                const requestStatus = getTeamRequestStatus(team, activePopup.type);
                const reviewTypes = getReviewTypes(team.markingSchema);
                const reviewTypeCfg = reviewTypes.find(r => r.key === activePopup.type);
                
                // Check if guide has approved PPT for PPT-required reviews
                const guidePPTStatus = getGuidePPTStatus(team, activePopup.type);
                const isBlockedByGuide = reviewTypeCfg?.requiresPPT && guidePPTStatus !== 'approved';
                
                return (
                  <PopupReview
                    title={`${reviewTypeCfg?.name || activePopup.type} - ${team.title}`}
                    teamMembers={team.students}
                    reviewType={activePopup.type}
                    isOpen={true}
                    locked={isLocked || isBlockedByGuide} // Block if guide hasn't approved
                    markingSchema={team.markingSchema}
                    requestStatus={requestStatus}
                    panelMode={true}
                    currentBestProject={team.bestProject || false}
                    onClose={() => setActivePopup(null)}
                    onSubmit={(data, pptObj, projectObj) => handleReviewSubmit(activePopup.teamId, activePopup.type, data, pptObj, projectObj)}
                    onRequestEdit={() => handleRequestEdit(activePopup.teamId, activePopup.type)}
                    requestEditVisible={isLocked && requestStatus !== 'none' && requestStatus !== 'rejected'}
                    requestPending={requestStatus === 'pending'}
                    requiresPPT={!!reviewTypeCfg?.requiresPPT}
                  />
                );
              })()
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Panel;
