import SearchBar from "@/components/search/SearchBar";

export default function HomeSearchBar() {
  return (
    <SearchBar
      scope="home"
      className="flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-2xl"
    />
  );
}
