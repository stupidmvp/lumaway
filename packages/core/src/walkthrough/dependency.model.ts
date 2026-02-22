export interface WalkthroughReference {
    walkthroughId: string;

    required?: boolean; // default true
    order?: number;     // sugerencia, no obligación

    dependsOn?: string[]; // otros walkthroughId
}
