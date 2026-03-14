import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { User, Mail, Briefcase, MapPin, FileText, Bell, Palette, Save } from "lucide-react";

const SPECIALTIES = ["Oncology", "Cardiology", "Infectious Diseases", "Neurology", "Immunology", "Endocrinology", "Pulmonology", "Rare Disease", "General Medicine"];
const TERRITORIES = ["Northeast Region", "Southeast Region", "Midwest Region", "Southwest Region", "West Coast", "Mountain West", "Mid-Atlantic", "National"];

export default function ProfileSettings() {
  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "Sales Representative",
    email: "rep@pharma.com",
    role: "Pharmaceutical Sales Representative",
    specialty: "Oncology",
    territory: "Northeast Region",
    bio: "",
  });
  const [prefs, setPrefs] = useState({
    theme: "system",
    emailNotifications: true,
    pushNotifications: true,
    dailyReminders: true,
    weeklyReports: true,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const initials = profile.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account information and preferences</p>
      </div>

      <div className="flex border-b border-gray-200 mb-8">
        {["profile", "preferences"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "profile" ? "Profile" : "Preferences"}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="space-y-8">
          {/* Avatar + Name */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ background: "#39ACAC" }}>
                  {initials}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{profile.fullName}</h2>
                  <p className="text-sm text-gray-500">{profile.role}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Member for Less than a month
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit Profile"}
              </Button>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Personal Information</h3>
            <p className="text-sm text-gray-500 mb-5">Your professional details and contact information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <Input value={profile.fullName} disabled={!editing} onChange={e => setProfile({ ...profile, fullName: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <Input value={profile.email} disabled className="text-sm bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Role
                </label>
                <Input value={profile.role} disabled={!editing} onChange={e => setProfile({ ...profile, role: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5" /> Specialty
                </label>
                {editing ? (
                  <Select value={profile.specialty} onValueChange={v => setProfile({ ...profile, specialty: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={profile.specialty} disabled className="text-sm" />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Territory
                </label>
                {editing ? (
                  <Select value={profile.territory} onValueChange={v => setProfile({ ...profile, territory: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TERRITORIES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={profile.territory} disabled className="text-sm" />
                )}
              </div>
            </div>
            <div className="mt-5">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Bio</label>
              <textarea
                value={profile.bio}
                disabled={!editing}
                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself and your experience..."
                rows={3}
                className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 resize-none"
              />
            </div>
            {editing && (
              <div className="flex justify-end mt-4">
                <Button onClick={handleSave} className="text-white" style={{ background: "#39ACAC" }}>
                  <Save className="w-4 h-4 mr-1.5" /> {saved ? "Saved!" : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "preferences" && (
        <div className="space-y-6">
          {/* Appearance */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">Appearance</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Customize how the platform looks</p>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Color Mode</label>
              <Select value={prefs.theme} onValueChange={v => setPrefs({ ...prefs, theme: v })}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Auto</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1.5">Choose your preferred color mode</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Manage how you receive updates and reminders</p>
            <div className="space-y-5">
              {[
                { key: "emailNotifications", label: "Email Notifications", desc: "Receive updates via email" },
                { key: "pushNotifications", label: "Push Notifications", desc: "Receive browser notifications" },
                { key: "dailyReminders", label: "Daily Practice Reminders", desc: "Get reminded to practice daily" },
                { key: "weeklyReports", label: "Weekly Progress Reports", desc: "Receive weekly summaries" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <Switch checked={prefs[key]} onCheckedChange={v => setPrefs({ ...prefs, [key]: v })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}