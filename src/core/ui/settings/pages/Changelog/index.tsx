import { CHANGELOG } from "@core/changelog";
import { ChangelogCard } from "@core/ui/components/ChangelogCard";
import { SafePage } from "@core/ui/components/SafeUI";

export default function Changelog() {
    return <SafePage>{CHANGELOG.map((e, i) => <ChangelogCard key={e.v} e={e} latest={i === 0} />)}</SafePage>;
}
