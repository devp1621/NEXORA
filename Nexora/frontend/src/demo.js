// Fictional sample students used by "Try Demo Profile". Always labelled as sample data in the UI.
export const DEMOS = {
  aarav: {
    key: "aarav",
    label: "Aarav Mehta: web developer aspirant",
    careerId: "fullstack",
    profile: {
      name: "Aarav Mehta",
      degree: "B.Tech",
      branch: "Computer Science and Engineering",
      year: "Semester 5",
      technicalSkills: [
        { name: "HTML/CSS", level: "advanced" },
        { name: "JS", level: "intermediate" },
        { name: "ReactJS", level: "intermediate" },
        { name: "Git", level: "intermediate" },
        { name: "REST API", level: "intermediate" },
        { name: "Python", level: "intermediate" },
        { name: "MySQL", level: "beginner" },
        { name: "Node", level: "beginner" },
      ],
      softSkills: ["Teamwork", "Communication", "Problem Solving"],
      projects: [
        {
          title: "Campus Event Finder",
          description: "React web app where students browse and register for campus events, using a mock REST backend.",
          technologies: ["React", "JavaScript", "HTML/CSS"],
        },
        {
          title: "Expense Tracker",
          description: "Tracks daily expenses with monthly summaries, storing records in a MySQL database through a small Node.js service.",
          technologies: ["Node", "MySQL", "JavaScript"],
        },
      ],
      certifications: [{ name: "Responsive Web Design", issuer: "freeCodeCamp" }],
      experience: [
        {
          role: "Web Team Volunteer",
          organization: "College Technical Club",
          description: "Maintained the club's event pages and fixed layout bugs before fests.",
        },
      ],
      achievements: ["Finalist, inter-college web design contest"],
    },
  },
  priya: {
    key: "priya",
    label: "Priya Nair: data science aspirant",
    careerId: "datascientist",
    profile: {
      name: "Priya Nair",
      degree: "B.Tech",
      branch: "Electronics and Communication Engineering",
      year: "Semester 6",
      technicalSkills: [
        { name: "Python", level: "advanced" },
        { name: "Stats", level: "intermediate" },
        { name: "Pandas", level: "intermediate" },
        { name: "Matplotlib", level: "intermediate" },
        { name: "sklearn", level: "beginner" },
        { name: "Git", level: "beginner" },
        { name: "Jupyter", level: "intermediate" },
      ],
      softSkills: ["Critical Thinking", "Attention to Detail"],
      projects: [
        {
          title: "Student Performance Predictor",
          description: "Predicts exam outcomes from attendance and study habits using classification models.",
          technologies: ["Python", "pandas", "scikit-learn"],
        },
        {
          title: "Air Quality Trends Dashboard",
          description: "Cleans a public air-quality dataset and visualizes monthly trends by city.",
          technologies: ["Python", "Matplotlib", "pandas"],
        },
      ],
      certifications: [{ name: "Machine Learning Foundations (online course)", issuer: "Online course platform" }],
      experience: [],
      achievements: ["Department topper, Semester 4"],
    },
  },
};

export const blankProfile = () => ({
  name: "",
  degree: "",
  branch: "",
  year: "",
  technicalSkills: [],
  softSkills: [],
  projects: [],
  certifications: [],
  experience: [],
  achievements: [],
  sample: null,
});
