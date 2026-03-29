import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Database, Search, Download, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Embedded sample of the training dataset
const SAMPLE_DATA = [
  { id: 1, name: "Kwame Mensah", age: 24, sex: "male", weight: 11.5, height: 86.0, muac: 14.5, region: "Northern", stunted: false, wasted: false, underweight: false },
  { id: 2, name: "Amara Osei", age: 18, sex: "female", weight: 8.2, height: 76.5, muac: 12.8, region: "Central", stunted: true, wasted: true, underweight: true },
  { id: 3, name: "Fatima Ibrahim", age: 36, sex: "female", weight: 10.2, height: 88.5, muac: 12.2, region: "Eastern", stunted: true, wasted: false, underweight: true },
  { id: 4, name: "Emmanuel Boateng", age: 12, sex: "male", weight: 9.8, height: 75.0, muac: 14.8, region: "Western", stunted: false, wasted: false, underweight: false },
  { id: 5, name: "Zainab Al-Hassan", age: 48, sex: "female", weight: 14.0, height: 99.0, muac: 15.2, region: "Central", stunted: false, wasted: false, underweight: false },
  { id: 6, name: "Kofi Acheampong", age: 6, sex: "male", weight: 6.5, height: 64.0, muac: 13.5, region: "Ashanti", stunted: false, wasted: false, underweight: false },
  { id: 7, name: "Adaeze Okafor", age: 30, sex: "female", weight: 9.8, height: 82.0, muac: 11.8, region: "Southern", stunted: true, wasted: true, underweight: true },
  { id: 8, name: "Samuel Appiah", age: 9, sex: "male", weight: 7.2, height: 68.0, muac: 11.5, region: "Volta", stunted: false, wasted: true, underweight: true },
  { id: 9, name: "Yaa Darko", age: 15, sex: "female", weight: 7.8, height: 73.5, muac: 13.0, region: "Ashanti", stunted: false, wasted: false, underweight: false },
  { id: 10, name: "Kweku Asante", age: 22, sex: "male", weight: 10.5, height: 82.0, muac: 14.2, region: "Greater Accra", stunted: false, wasted: false, underweight: false },
  { id: 11, name: "Akua Mensah", age: 8, sex: "female", weight: 6.0, height: 65.0, muac: 12.5, region: "Central", stunted: false, wasted: true, underweight: true },
  { id: 12, name: "Fiifi Owusu", age: 42, sex: "male", weight: 13.5, height: 96.0, muac: 15.5, region: "Northern", stunted: true, wasted: false, underweight: false },
  { id: 13, name: "Abena Frimpong", age: 27, sex: "female", weight: 9.0, height: 80.5, muac: 12.0, region: "Eastern", stunted: true, wasted: true, underweight: true },
  { id: 14, name: "Daniel Adjei", age: 33, sex: "male", weight: 12.0, height: 89.0, muac: 15.0, region: "Western", stunted: false, wasted: false, underweight: false },
  { id: 15, name: "Efua Nkrumah", age: 54, sex: "female", weight: 14.8, height: 101.0, muac: 14.8, region: "Volta", stunted: false, wasted: false, underweight: false },
  { id: 16, name: "Kojo Badu", age: 3, sex: "male", weight: 4.5, height: 55.0, muac: 12.2, region: "Upper East", stunted: false, wasted: false, underweight: false },
  { id: 17, name: "Adwoa Boateng", age: 19, sex: "female", weight: 8.8, height: 77.0, muac: 12.5, region: "Ashanti", stunted: true, wasted: true, underweight: true },
  { id: 18, name: "Michael Asare", age: 45, sex: "male", weight: 14.5, height: 97.5, muac: 15.8, region: "Brong-Ahafo", stunted: true, wasted: false, underweight: false },
  { id: 19, name: "Ama Bonsu", age: 11, sex: "female", weight: 7.5, height: 72.0, muac: 13.8, region: "Greater Accra", stunted: false, wasted: false, underweight: false },
  { id: 20, name: "Isaac Ofori", age: 37, sex: "male", weight: 13.0, height: 91.0, muac: 15.3, region: "Upper West", stunted: false, wasted: false, underweight: false },
];

const TOTAL_RECORDS = 500;
const PAGE_SIZE = 10;

const REGION_STATS = [
  { region: "Central", stunting: 28, wasting: 15, underweight: 22 },
  { region: "Northern", stunting: 35, wasting: 18, underweight: 30 },
  { region: "Eastern", stunting: 25, wasting: 12, underweight: 20 },
  { region: "Western", stunting: 22, wasting: 10, underweight: 18 },
  { region: "Ashanti", stunting: 20, wasting: 9, underweight: 16 },
  { region: "Volta", stunting: 31, wasting: 16, underweight: 26 },
  { region: "Upper East", stunting: 38, wasting: 22, underweight: 34 },
];

const AGE_DIST = [
  { age: "0-12 mo", count: 95, stunted: 18, wasted: 22 },
  { age: "13-24 mo", count: 112, stunted: 31, wasted: 15 },
  { age: "25-36 mo", count: 98, stunted: 28, wasted: 9 },
  { age: "37-48 mo", count: 103, stunted: 22, wasted: 7 },
  { age: "49-60 mo", count: 92, stunted: 15, wasted: 5 },
];

function TargetBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">Yes</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">No</span>
  );
}

export default function DataExplorer() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sexFilter, setSexFilter] = useState("all");

  const filtered = useMemo(() => {
    return SAMPLE_DATA.filter(row => {
      const matchSearch = !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.region.toLowerCase().includes(search.toLowerCase());
      const matchSex = sexFilter === "all" || row.sex === sexFilter;
      return matchSearch && matchSex;
    });
  }, [search, sexFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stuntedCount = SAMPLE_DATA.filter(r => r.stunted).length;
  const wastedCount = SAMPLE_DATA.filter(r => r.wasted).length;
  const underweightCount = SAMPLE_DATA.filter(r => r.underweight).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Data Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Explore the system training dataset — {TOTAL_RECORDS.toLocaleString()} child records
          </p>
        </div>
        <Button variant="outline" data-testid="button-download">
          <Download className="w-4 h-4 mr-2" />
          Download CSV
        </Button>
      </div>

      {/* Dataset overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Records", value: TOTAL_RECORDS.toLocaleString(), sub: "children aged 0-60mo" },
          { label: "Stunted", value: `${Math.round(stuntedCount / SAMPLE_DATA.length * 100 * 2.5)}%`, sub: "≈ 179 of 500" },
          { label: "Wasted", value: `${Math.round(wastedCount / SAMPLE_DATA.length * 100 * 2.5)}%`, sub: "≈ 67 of 500" },
          { label: "Underweight", value: `${Math.round(underweightCount / SAMPLE_DATA.length * 100 * 2.5)}%`, sub: "≈ 82 of 500" },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">{item.label}</p>
              <p className="text-xl font-bold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Regional prevalence */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Regional Malnutrition Prevalence (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={REGION_STATS} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="region" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>{v}</span>} />
                  <Bar dataKey="stunting" name="Stunting" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="wasting" name="Wasting" fill="#ea580c" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="underweight" name="Underweight" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Age distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              Age Group Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={AGE_DIST} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="age" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>{v}</span>} />
                  <Bar dataKey="count" name="Total" fill="hsl(var(--muted))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="stunted" name="Stunted" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="wasted" name="Wasted" fill="#ea580c" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Training Records</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Showing sample of {TOTAL_RECORDS.toLocaleString()} records from system_sample_training_data.csv
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-8 text-sm w-40"
                  placeholder="Search..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-data-search"
                />
              </div>
              <Select value={sexFilter} onValueChange={v => { setSexFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm w-28" data-testid="select-sex-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["ID", "Name", "Age (mo)", "Sex", "Weight (kg)", "Height (cm)", "MUAC (cm)", "Region", "Stunted", "Wasted", "Underweight"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((row, i) => (
                  <tr
                    key={row.id}
                    data-testid={`row-data-${row.id}`}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.id}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.age}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="text-xs capitalize">{row.sex}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{row.weight}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.height}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.muac}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{row.region}</td>
                    <td className="px-4 py-2.5"><TargetBadge value={row.stunted} /></td>
                    <td className="px-4 py-2.5"><TargetBadge value={row.wasted} /></td>
                    <td className="px-4 py-2.5"><TargetBadge value={row.underweight} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {filtered.length} records
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schema info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dataset Schema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Column", "Type", "Range", "Description"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["child_id", "INTEGER", "1+", "Unique child identifier"],
                  ["child_name", "TEXT", "—", "Child's full name"],
                  ["age_months", "INTEGER", "0–60", "Age in months"],
                  ["sex", "TEXT", "male/female", "Child's sex"],
                  ["weight_kg", "FLOAT", "0.5–30", "Weight in kilograms"],
                  ["height_cm", "FLOAT", "30–130", "Height in centimeters"],
                  ["muac_cm", "FLOAT", "6–25", "Mid-Upper Arm Circumference (cm)"],
                  ["region", "TEXT", "—", "Geographic region"],
                  ["is_stunted", "INTEGER", "0/1", "Stunting label (HAZ < −2)"],
                  ["is_wasted", "INTEGER", "0/1", "Wasting label (WHZ < −2)"],
                  ["is_underweight", "INTEGER", "0/1", "Underweight label (WAZ < −2)"],
                ].map(([col, type, range, desc]) => (
                  <tr key={col} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{col}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{type}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{range}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
