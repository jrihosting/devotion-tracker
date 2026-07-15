import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronRight, Save, Search, AlertCircle } from 'lucide-react'

// ─── Dummy data ───────────────────────────────────────────────
const INITIAL_DATA = {
  connections: [
    { id: '1', name: 'Members', role: 'lookup', spreadsheetId: 'abc123', sheetTab: 'DB' },
    { id: '2', name: 'Devotionals', role: 'devotion', spreadsheetId: 'def456', sheetTab: 'DEVOTION TRACKER' },
    { id: '3', name: 'Connections', role: 'reference', spreadsheetId: 'ghi789', sheetTab: 'SETUP' },
    { id: '4', name: 'Users', role: 'users', spreadsheetId: 'jkl012', sheetTab: 'USERS' },
  ],
  fieldDefinitions: {
    members: [
      'ID','CAMPUS','FIRST NAME','LAST NAME','PHONE','HOME PHONE','WORK PHONE',
      'EMAIL','WORK EMAIL','GENDER','DOB','ADDRESS','CITY','STATE','ZIP CODE',
      'COUNTRY','LADDER','MINISTRY','STATUS','TEMPERAMENT','SPIRITUAL GIFT',
      'MARITAL STATUS','PROFILE LINK','EDUCATION','PROFESSION','CAMPUS TYPE',
      'TRAINING','LEVEL','CLEAN PHONE','IS BAPTIZED','BAPTISM DATE',
    ],
    devotionals: ['date','name','campus','ministry','phone','email'],
    connections: ['name','role','spreadsheetId','sheetTab'],
    users: ['Email','PIN','Role'],
  },
  savedMappings: {
    members: { ID: 'ID', 'FIRST NAME': 'FIRST NAME' },
  },
}

const SHEET_COLUMNS = {
  members: [
    { name: 'ID' }, { name: 'CAMPUS' }, { name: 'FIRST NAME' }, { name: 'LAST NAME' },
    { name: 'PHONE' }, { name: 'EMAIL' }, { name: 'MINISTRY' }, { name: 'STATUS' },
    { name: 'LADDER' }, { name: 'GENDER' }, { name: 'DOB' }, { name: 'ADDRESS' },
    { name: 'CITY' }, { name: 'CLEAN PHONE' }, { name: 'MARITAL STATUS' },
    { name: 'EDUCATION' }, { name: 'PROFESSION' }, { name: 'CAMPUS TYPE' },
    { name: 'TRAINING' }, { name: 'LEVEL' }, { name: 'IS BAPTIZED' }, { name: 'BAPTISM DATE' },
  ],
  devotionals: [
    { name: 'date' }, { name: 'name' }, { name: 'campus' }, { name: 'ministry' },
    { name: 'phone' }, { name: 'email' }, { name: 'FULL NAME' }, { name: 'CAMPUS' },
  ],
  connections: [
    { name: 'name' }, { name: 'role' }, { name: 'spreadsheetId' }, { name: 'sheetTab' },
  ],
  users: [
    { name: 'Email' }, { name: 'PIN' }, { name: 'Role' }, { name: 'FULL NAME' }, { name: 'CAMPUS' },
  ],
}

// ─── Helper ───────────────────────────────────────────────────
function getRoleLabel(role) {
  const labels = { lookup: 'Manm', devotion: 'Devotion', reference: 'Koneksyon', users: 'Itilizatè' }
  return labels[role] || role
}

// ─── Component ────────────────────────────────────────────────
export default function ColumnMapping() {
  const [connections] = useState(INITIAL_DATA.connections)
  const [fieldDefinitions] = useState(INITIAL_DATA.fieldDefinitions)
  const [savedMappings, setSavedMappings] = useState(INITIAL_DATA.savedMappings)
  const [selectedConnId, setSelectedConnId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [localMappings, setLocalMappings] = useState({})
  const tableRef = useRef(null)

  // Derive current page type from selected connection
  const selectedConn = useMemo(
    () => connections.find(c => c.id === selectedConnId) || null,
    [connections, selectedConnId]
  )

  const pageType = selectedConn
    ? ({ lookup: 'members', devotion: 'devotionals', reference: 'connections', users: 'users' })[selectedConn.role]
    : null

  // Get fields for the current page
  const allFields = useMemo(
    () => (pageType ? fieldDefinitions[pageType] : []),
    [pageType, fieldDefinitions]
  )

  // Get sheet columns for the current page
  const sheetColumns = useMemo(
    () => (pageType ? SHEET_COLUMNS[pageType] || [] : []),
    [pageType]
  )

  // Build working mapping: local overrides > saved > default (field name)
  const workingMapping = useMemo(() => {
    if (!pageType) return {}
    const defaults = {}
    allFields.forEach(f => { defaults[f] = f })
    return { ...defaults, ...(savedMappings[pageType] || {}), ...(localMappings[pageType] || {}) }
  }, [pageType, allFields, savedMappings, localMappings])

  // Filter fields by search term
  const filteredFields = useMemo(() => {
    if (!searchTerm.trim()) return allFields
    const term = searchTerm.toLowerCase()
    return allFields.filter(f => f.toLowerCase().includes(term))
  }, [allFields, searchTerm])

  // Handle dropdown change
  function handleFieldChange(fieldName, value) {
    if (!pageType) return
    setLocalMappings(prev => ({
      ...prev,
      [pageType]: { ...(prev[pageType] || {}), [fieldName]: value || fieldName },
    }))
  }

  // Save
  function handleSave() {
    if (!pageType) return
    setSavedMappings(prev => ({
      ...prev,
      [pageType]: { ...(prev[pageType] || {}), ...(localMappings[pageType] || {}) },
    }))
    setLocalMappings(prev => {
      const next = { ...prev }
      delete next[pageType]
      return next
    })
  }

  // Has unsaved changes?
  const hasUnsaved = pageType && localMappings[pageType]

  // Open connection / close to show "add" form
  function handleSelectConnection(id) {
    setSelectedConnId(prev => (prev === id ? null : id))
    setSearchTerm('')
  }

  function handleAddNew() {
    setSelectedConnId(null)
    setSearchTerm('')
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <h2 className="text-lg font-bold text-gray-900 mb-1">📋 Konfigirasyon Chan</h2>
        <p className="text-sm text-gray-500 mb-6">
          Chwazi yon koneksyon pou konfigure ki kolòn Google Sheet koresponn ak chak chan.
        </p>

        {/* ─── Connection Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {connections.map(conn => {
            const isSelected = selectedConnId === conn.id
            return (
              <button
                key={conn.id}
                onClick={() => handleSelectConnection(conn.id)}
                className={`
                  relative rounded-xl border-2 p-4 text-left transition-all
                  ${isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-500/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900">{conn.name}</span>
                  {isSelected && (
                    <span className="size-2 rounded-full bg-indigo-500" />
                  )}
                </div>
                <div className="text-xs text-gray-500">{getRoleLabel(conn.role)}</div>
                <div className="text-xs text-gray-400 mt-1 truncate">{conn.sheetTab}</div>
              </button>
            )
          })}

          {/* Add new card */}
          <button
            onClick={handleAddNew}
            className={`
              rounded-xl border-2 border-dashed p-4 text-center transition-all
              ${selectedConnId === null
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
              }
            `}
          >
            <div className="text-2xl mb-1">+</div>
            <div className="text-sm font-medium text-gray-600">Ajoute</div>
          </button>
        </div>

        {/* ─── Master-Detail Content ─── */}
        {selectedConn ? (
          <>
            {/* Connection info bar */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <span className="font-semibold text-gray-900">{selectedConn.name}</span>
              <ChevronRight className="size-4 text-gray-400" />
              <span className="text-gray-500">{selectedConn.sheetTab}</span>
              <span className="ml-auto text-xs text-gray-400">
                {allFields.length} chan &middot; {sheetColumns.length} kolòn
              </span>
            </div>

            {/* Search bar */}
            {allFields.length > 0 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="🔍 Chèche chan..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div ref={tableRef} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Chan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Kolòn Google Sheet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredFields.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                          {searchTerm ? 'Pa jwenn chan ki matche' : 'Pa gen chan defini'}
                        </td>
                      </tr>
                    ) : (
                      filteredFields.map((fieldName, i) => {
                        const mappedValue = workingMapping[fieldName] || fieldName
                        const hasNoMapping = !sheetColumns.some(c => c.name === mappedValue)
                        const isDefault = mappedValue === fieldName
                        const isUnmapped = isDefault && !sheetColumns.some(c => c.name === fieldName)

                        return (
                          <tr
                            key={fieldName}
                            className={`
                              transition-colors
                              ${isUnmapped ? 'bg-amber-50/60' : ''}
                              ${i % 2 === 0 ? '' : 'bg-gray-50/30'}
                            `}
                          >
                            <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{fieldName}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <select
                                  value={mappedValue}
                                  onChange={e => handleFieldChange(fieldName, e.target.value)}
                                  className={`
                                    w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none transition-colors
                                    ${isUnmapped
                                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                                      : 'border-gray-300 bg-white text-gray-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                                    }
                                  `}
                                >
                                  <option value="">— Chwazi yon kolòn —</option>
                                  {sheetColumns.map(col => (
                                    <option key={col.name} value={col.name}>
                                      {col.name}
                                    </option>
                                  ))}
                                </select>
                                {isUnmapped && (
                                  <AlertCircle className="size-4 text-amber-500 shrink-0" title="Pa gen kolòn ki koresponn" />
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Load columns button + Save bar */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  // Load columns from sheet (mock: already loaded)
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                📂 Chaje kolòn soti nan Sheet
              </button>
            </div>

            {/* Sticky save bar */}
            <div className="sticky bottom-0 mt-4 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-white/90 backdrop-blur-lg border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
              <div className="mx-auto max-w-5xl flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {filteredFields.length} chan afichye
                  {filteredFields.length !== allFields.length && ` / ${allFields.length} total`}
                </span>
                <button
                  onClick={handleSave}
                  disabled={!hasUnsaved}
                  className={`
                    inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-all
                    ${hasUnsaved
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Save className="size-4" />
                  Anrejistre
                </button>
              </div>
            </div>
          </>
        ) : selectedConnId === null ? (
          /* Empty form for "Ajoute" */
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-10 text-center">
            <div className="text-4xl mb-3">➕</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Kreye yon nouvo mapping</h3>
            <p className="text-sm text-gray-400">Fòm ajoute ap vini isit la.</p>
          </div>
        ) : (
          /* No selection */
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
            <span className="text-3xl">👆</span>
            <p className="mt-3 text-sm text-gray-400">Please select a connection above to configure its fields.</p>
          </div>
        )}

      </div>
    </div>
  )
}