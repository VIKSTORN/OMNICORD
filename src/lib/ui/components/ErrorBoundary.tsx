import ErrorCard from "@core/ui/reporter/components/ErrorCard";
import { React } from "@metro/common";
import { ThemeContext } from "@ui/styles";
import { Falsy, ScrollView, Text } from "react-native";

type ErrorBoundaryState = {
    hasErr: false;
} | {
    hasErr: true;
    error: Error;
};

export interface ErrorBoundaryProps {
    children: JSX.Element | Falsy | (JSX.Element | Falsy)[];
}

/** Last-resort fallback: if Discord's components can't render the error card, show plain text instead of a blank screen. */
class PlainFallback extends React.Component<{ error: Error; children: any }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError = () => ({ failed: true });
    render() {
        if (!this.state.failed) return this.props.children;
        const e = this.props.error;
        return (
            <ScrollView style={{ flex: 1, backgroundColor: "#1e1f22" }} contentContainerStyle={{ padding: 16, gap: 8 }}>
                <Text style={{ color: "#f2f3f5", fontSize: 20, fontWeight: "700" }}>Omnicord: something crashed</Text>
                <Text style={{ color: "#b5bac1" }}>Screenshot this and send it to fix it.</Text>
                <Text selectable style={{ color: "#f2f3f5", fontFamily: "monospace", fontSize: 12 }}>{String(e?.stack ?? e)}</Text>
            </ScrollView>
        );
    }
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasErr: false };
    }

    static contextType = ThemeContext;
    static getDerivedStateFromError = (error: Error) => ({ hasErr: true, error });

    render() {
        if (!this.state.hasErr) return this.props.children;

        return (
            <PlainFallback error={this.state.error}>
                <ErrorCard
                    error={this.state.error}
                    onRetryRender={() => this.setState({ hasErr: false })}
                />
            </PlainFallback>
        );
    }
}
