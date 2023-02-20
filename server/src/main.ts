const rpcIdFindMatch = 'find_match_js';

let InitModule: nkruntime.InitModule =
        function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
            initializer.registerRpc(rpcIdFindMatch, rpcFindMatch);        
            initializer.registerMatch(moduleName, {
                matchInit,
                matchJoinAttempt,
                matchJoin,
                matchLeave,
                matchLoop,
                matchTerminate,
                matchSignal,
            });
        
            logger.info('JavaScript logic loaded.');}

