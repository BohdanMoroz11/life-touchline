import { useRoute } from "./lib";
import { MatchesPage } from "./components/MatchesPage";
import { MatchPage } from "./components/MatchPage";
import { Tooltips } from "./components/ui";

export function App() {
  const route = useRoute();
  // The match page is a fixed-viewport dashboard; the match list is a normal page.
  return (
    <>
      {route.page === "match" ? <MatchPage league={route.league} id={route.id} player={route.player} /> : <MatchesPage date={route.date} />}
      <Tooltips />
    </>
  );
}
