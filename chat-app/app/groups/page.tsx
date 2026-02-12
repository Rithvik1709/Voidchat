import GroupList from "@/components/GroupList";

export default function GroupsPage() {
    return (
        <main className="min-h-screen bg-background selection:bg-primary selection:text-primary-foreground flex flex-col">
            <div className="flex-1">
                <GroupList />
            </div>
            <footer className="w-full py-6">
                <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-2 px-6 text-center">
                    <span className="text-[11px] text-muted-foreground">
                        Ideas, bugs, or bold takes? Tell us at <a className="underline underline-offset-2 hover:text-foreground transition-colors" href="mailto:feedback@nullchat.tech">feedback@nullchat.tech</a>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        Stuck or something feels off? We’re listening: <a className="underline underline-offset-2 hover:text-foreground transition-colors" href="mailto:support@nullchat.tech">support@nullchat.tech</a>
                    </span>
                </div>
            </footer>
        </main>
    );
}