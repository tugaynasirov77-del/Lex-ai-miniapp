import HomeHeader from "../components/HomeHeader";
import TaskHero from "../components/TaskHero";
import AgentsScroll from "../components/AgentsScroll";
import ActiveTasks from "../components/ActiveTasks";
import RecentProjects from "../components/RecentProjects";
import AnalyticsTeaser from "../components/AnalyticsTeaser";

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <TaskHero />
      <AgentsScroll />
      <ActiveTasks />
      <RecentProjects />
      <AnalyticsTeaser />
    </>
  );
}
