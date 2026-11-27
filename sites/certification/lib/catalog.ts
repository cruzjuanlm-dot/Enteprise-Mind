import coursesFile from "../content/courses.json";
import tiersFile from "../content/tiers.json";

export type Course = {
  slug: string;
  level: string;
  title: string;
  summary: string;
  modules: string[];
  outcomes: string[];
  hours: number;
  format: string;
  prerequisite: string | null;
  registryId: string;
};

export type AssessmentPart = {
  part: string;
  weight: string;
  covers: string;
};

export type Tier = {
  slug: string;
  name: string;
  audience: string;
  prerequisites: string[];
  courseSlug: string;
  term: string;
  assessment: AssessmentPart[];
  renewal: string;
  status: "proposed";
};

const courses = coursesFile.courses as Course[];
const tiers = tiersFile.tiers as Tier[];

export function getCourses(): Course[] {
  return courses;
}

export function getCourse(slug: string): Course | undefined {
  return courses.find((course) => course.slug === slug);
}

export function getTiers(): Tier[] {
  return tiers;
}

export function getTier(slug: string): Tier | undefined {
  return tiers.find((tier) => tier.slug === slug);
}

export function tierForCourse(slug: string): Tier | undefined {
  return tiers.find((tier) => tier.courseSlug === slug);
}

export function prerequisiteCourse(course: Course): Course | undefined {
  if (!course.prerequisite) return undefined;
  return getCourse(course.prerequisite);
}

const levels = ["Language", "Practitioner", "Steward", "Master", "Trainer"] as const;

export function coursesByLevel(): { level: string; courses: Course[] }[] {
  return levels.map((level) => ({
    level,
    courses: courses.filter((course) => course.level === level),
  }));
}

export function catalogIssues(): string[] {
  const issues: string[] = [];
  const courseSlugs = new Set<string>();
  const tierSlugs = new Set<string>();

  for (const course of courses) {
    if (courseSlugs.has(course.slug)) issues.push(`Duplicate course slug ${course.slug}.`);
    courseSlugs.add(course.slug);
    if (!course.registryId.startsWith("comp.")) {
      issues.push(`Course ${course.slug} registry id must start with comp.`);
    }
    if (course.modules.length === 0) issues.push(`Course ${course.slug} has no modules.`);
    if (course.outcomes.length === 0) issues.push(`Course ${course.slug} has no outcomes.`);
  }

  for (const tier of tiers) {
    if (tierSlugs.has(tier.slug)) issues.push(`Duplicate tier slug ${tier.slug}.`);
    tierSlugs.add(tier.slug);
    if (tier.status !== "proposed") {
      issues.push(`Tier ${tier.slug} must stay proposed in this prototype.`);
    }
    if (!courseSlugs.has(tier.courseSlug)) {
      issues.push(`Tier ${tier.slug} points at missing course ${tier.courseSlug}.`);
    }
    if (tier.assessment.length === 0) {
      issues.push(`Tier ${tier.slug} has no assessment blueprint.`);
    }
    if (!tier.term) issues.push(`Tier ${tier.slug} needs a term.`);
  }

  for (const course of courses) {
    if (course.prerequisite && !courseSlugs.has(course.prerequisite)) {
      issues.push(`Course ${course.slug} prerequisite ${course.prerequisite} is missing.`);
    }
    if (!tiers.some((tier) => tier.courseSlug === course.slug)) {
      issues.push(`Course ${course.slug} is not the course for any tier.`);
    }
  }

  if (courses.length !== 5) {
    issues.push(`Expected 5 courses, found ${courses.length}.`);
  }
  if (tiers.length !== 5) {
    issues.push(`Expected 5 tiers, found ${tiers.length}.`);
  }

  return issues;
}

export function assertCatalog(): void {
  const issues = catalogIssues();
  if (issues.length > 0) {
    throw new Error(issues.join("\n"));
  }
}
