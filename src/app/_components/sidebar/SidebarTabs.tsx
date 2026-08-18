import type { SidebarTab } from "../../_types/sidebar";

interface SidebarTabsProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  const tabs: { key: SidebarTab; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "query", label: "Query" },
    { key: "history", label: "Graphs" },
  ];

  return (
    <div className="flex border-b border-gray-200 bg-white">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === tab.key
              ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50"
              : "text-gray-600 hover:text-teal-700 hover:bg-teal-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
