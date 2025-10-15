import {
  ChevronRight,
  ChevronDown,
  Users,
  Building2,
  Trash2,
  MapPin,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ClipboardList,
} from 'lucide-react';

const PanelCard = ({ 
  panel, 
  index, 
  isExpanded, 
  onToggleExpand, 
  onRemovePanel,
  availableTeams,
  onManualAssign,
  unassignedTeams,
  allGuideProjects,
  onRemoveTeam
}) => {
  // ✅ FIXED: Handle array fields from new schema
  const displaySchool = Array.isArray(panel.school) ? panel.school.join(', ') : (panel.school || 'Unknown');
  const displayDepartment = Array.isArray(panel.department) ? panel.department.join(', ') : (panel.department || 'Unknown');

  const panelStatusConfig = {
    all: {
      label: 'Fully Marked',
      className: 'bg-emerald-100 text-emerald-700',
      icon: CheckCircle,
    },
    partial: {
      label: 'Partially Marked',
      className: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
    },
    none: {
      label: 'No Marks',
      className: 'bg-rose-100 text-rose-700',
      icon: XCircle,
    },
    'no-projects': {
      label: 'No Projects',
      className: 'bg-slate-100 text-slate-600',
      icon: ClipboardList,
    },
  };

  const panelStatus = panel.markSummary?.status || 'unknown';
  const panelStatusMeta = panelStatusConfig[panelStatus];

  const teamStatusConfig = {
    full: {
      label: 'Fully Marked',
      className: 'bg-emerald-100 text-emerald-700',
      icon: CheckCircle,
    },
    partial: {
      label: 'Partially Marked',
      className: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
    },
    none: {
      label: 'No Marks',
      className: 'bg-rose-100 text-rose-700',
      icon: XCircle,
    },
    'no-schema': {
      label: 'Schema Missing',
      className: 'bg-slate-100 text-slate-600',
      icon: AlertTriangle,
    },
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-gradient-to-r from-white to-slate-50 hover:shadow-lg transition-all duration-300">
      {/* Panel Header */}
      <div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 cursor-pointer hover:bg-slate-50 transition-colors gap-4 sm:gap-0"
        onClick={onToggleExpand}
      >
        <div className="flex items-center space-x-4 w-full sm:w-auto">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
            {isExpanded ? (
              <ChevronDown className="text-blue-600 h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <ChevronRight className="text-blue-600 h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-bold text-lg sm:text-xl text-slate-800">
                Panel {index + 1}: {panel.facultyNames.join(" & ")}
              </h4>
              {/* ✅ Display venue if available */}
              {panel.venue && (
                <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  <MapPin className="w-3 h-3" />
                  <span>{panel.venue}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm text-slate-600">
              <span className="flex items-center space-x-1">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{panel.teams.length} teams assigned</span>
              </span>
              {/* ✅ FIXED: Handle array departments */}
              <span className="flex items-center space-x-1">
                <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{displayDepartment}</span>
              </span>
              {/* ✅ FIXED: Show school if different from department */}
              {displaySchool && displaySchool !== displayDepartment && (
                <span className="flex items-center space-x-1">
                  <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{displaySchool}</span>
                </span>
              )}
              {panel.teams.length > 0 && (
                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-semibold">
                  Active
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {panelStatusMeta && (
              <span className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${panelStatusMeta.className}`}>
                <panelStatusMeta.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{panelStatusMeta.label}</span>
                {panel.markSummary && (
                  <span className="text-[10px] sm:text-xs font-medium">
                    {panel.markSummary.fullyMarkedProjects || 0}/{panel.markSummary.totalProjects || 0}
                  </span>
                )}
              </span>
            )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemovePanel(panel.panelId);
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 text-sm"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            Remove Panel
          </button>
        </div>
      </div>

      {/* Expanded Panel Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-4 sm:p-6 bg-slate-50">
          {/* Panel Information */}
          <div className="mb-6 bg-white rounded-xl p-4 border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ✅ FIXED: Display arrays properly */}
              <div className="flex items-center gap-2 text-blue-600">
                <Building2 className="w-5 h-5" />
                <div>
                  <span className="font-medium block">Department:</span>
                  <span className="text-sm text-slate-600">{displayDepartment}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-purple-600">
                <BookOpen className="w-5 h-5" />
                <div>
                  <span className="font-medium block">School:</span>
                  <span className="text-sm text-slate-600">{displaySchool}</span>
                </div>
              </div>

              {panel.venue && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <MapPin className="w-5 h-5" />
                  <div>
                    <span className="font-medium block">Venue:</span>
                    <span className="text-sm text-slate-600">{panel.venue}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ FIXED: Faculty Member Details */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <span className="font-medium text-slate-700 block mb-2">Panel Members:</span>
              <div className="flex flex-wrap gap-2">
                {panel.facultyNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{name}</span>
                    {panel.facultyEmployeeIds && panel.facultyEmployeeIds[idx] && (
                      <span className="text-xs bg-blue-200 px-1.5 py-0.5 rounded">
                        ID: {panel.facultyEmployeeIds[idx]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {panel.markSummary && panel.markSummary.totalProjects > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Fully Marked: {panel.markSummary.fullyMarkedProjects}</span>
                </div>
                <div className="bg-amber-50 text-amber-700 rounded-lg px-3 py-2 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Partial: {panel.markSummary.partialProjects}</span>
                </div>
                <div className="bg-rose-50 text-rose-700 rounded-lg px-3 py-2 font-medium flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  <span>Unmarked: {panel.markSummary.unmarkedProjects}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Assigned Teams Section */}
          <div className="mb-8">
            <h5 className="font-bold text-lg sm:text-xl mb-4 sm:mb-6 text-slate-800 flex items-center space-x-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              <span>Assigned Teams</span>
            </h5>
            
            {panel.teams.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-6">
                <div className="flex items-center space-x-3 text-amber-800">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                  <div>
                    <span className="font-bold block text-sm sm:text-base">No Teams Assigned</span>
                    <span className="text-xs sm:text-sm text-amber-700">Use the dropdown below to assign teams to this panel</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
                {panel.teams.map((team) => {
                  const statusKey = team.markStatus?.status;
                  const config = teamStatusConfig[statusKey] || {};
                  const StatusIcon = config.icon || AlertTriangle;
                  const statusClass = config.className || "bg-slate-100 text-slate-600";
                  const statusLabel = config.label || "Status Unknown";

                  return (
                    <div key={team.id} className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <h6 className="font-bold text-base sm:text-lg text-slate-800 mb-1">{team.name}</h6>
                          {team.full && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {team.full.domain && (
                                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {team.full.domain}
                                </span>
                              )}
                              {team.full.type && (
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {team.full.type}
                                </span>
                              )}
                              {team.full.school && (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {team.full.school}
                                </span>
                              )}
                              {team.full.department && (
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {team.full.department}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {team.markStatus && (
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs sm:text-sm font-semibold ${statusClass}`}>
                            <StatusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{statusLabel}</span>
                            {typeof team.markStatus.studentsFullyMarked === "number" &&
                              typeof team.markStatus.totalStudents === "number" &&
                              team.markStatus.totalStudents > 0 && (
                                <span className="text-[10px] sm:text-xs font-medium">
                                  {team.markStatus.studentsFullyMarked}/{team.markStatus.totalStudents}
                                </span>
                              )}
                          </div>
                        )}
                        <button
                          onClick={() => onRemoveTeam(team.id)}
                          className="text-red-600 hover:text-red-800 p-1.5 sm:p-2 rounded-lg hover:bg-red-50 transition-all duration-200 flex items-center gap-1 text-xs sm:text-sm font-medium ml-2"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          Remove
                        </button>
                      </div>

                      {team.members && team.members.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 space-x-0 sm:space-x-3 p-2 sm:p-3 bg-slate-50 rounded-lg">
                            <span className="font-semibold text-slate-700 text-sm sm:text-base">Team Members:</span>
                            <div className="flex flex-wrap gap-1 sm:gap-2">
                              {team.members.map((member, memberIdx) => (
                                <span
                                  key={`${team.id}-member-${memberIdx}`}
                                  className="bg-blue-100 text-blue-800 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs sm:text-sm font-semibold"
                                >
                                  {member}
                                </span>
                              ))}
                            </div>
                          </div>

                          {team.full?.guideFaculty && (
                            <div className="p-2 sm:p-3 bg-green-50 rounded-lg">
                              <span className="font-semibold text-green-700 text-sm">Guide: </span>
                              <span className="text-green-800 text-sm">
                                {typeof team.full.guideFaculty === "object"
                                  ? team.full.guideFaculty.name
                                  : team.full.guideFaculty}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual Assignment Section */}
          <div className="border-t border-slate-200 pt-6">
            <h5 className="font-bold text-lg sm:text-xl mb-4 text-slate-800 flex items-center space-x-2">
              <span>Manual Assignment</span>
              <span className="text-xs sm:text-sm font-normal text-slate-500">
                ({availableTeams.length} available)
              </span>
            </h5>
            
            {availableTeams.length === 0 ? (
              <div className="bg-slate-100 p-3 sm:p-4 rounded-xl text-center">
                <span className="text-slate-600 font-medium text-sm sm:text-base">
                  {unassignedTeams.length === 0
                    ? "✅ All teams have been assigned"
                    : "⚠️ No teams available (guide conflicts)"}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      onManualAssign(panel.panelId, e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="w-full p-2 sm:p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm sm:text-base"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select team to assign to this panel
                  </option>
                  {availableTeams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name} 
                      {team.domain && ` - ${team.domain}`}
                      {team.school && ` (${team.school})`}
                    </option>
                  ))}
                </select>

                {/* ✅ FIXED: Show preview of available teams */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-blue-800 block mb-2">Available Teams Preview:</span>
                  <div className="flex flex-wrap gap-1">
                    {availableTeams.slice(0, 5).map((team) => (
                      <span key={team._id} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                        {team.name}
                      </span>
                    ))}
                    {availableTeams.length > 5 && (
                      <span className="text-blue-600 text-xs font-medium">
                        +{availableTeams.length - 5} more...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelCard;
