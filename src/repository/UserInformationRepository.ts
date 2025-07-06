import { App } from "@slack/bolt";

const getUserInformation = (app: App, userId: string): Promise<string | null> => 
    app.client.users.info({ user: userId })
        .then(result => result.user?.name ?? null)
        .catch(error => {
            console.error(`Error getting user information for ${userId}:`, error);
            return null;
        });

export {
    getUserInformation
};

