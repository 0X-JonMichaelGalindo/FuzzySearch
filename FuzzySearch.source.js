const FuzzySearch = function( options = {} ) {
    /*
        ~FuzzySearch~

        An in-browser, client-side search engine.
    */

    /*
        MIT License

        Copyright 2020 Jon Michael Galindo

        Permission is hereby granted, free of charge, to any person obtaining a copy of
        this software and associated documentation files (the "Software"), to deal in 
        the Software without restriction, including without limitation the rights to 
        use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies 
        of the Software, and to permit persons to whom the Software is furnished to do
        so, subject to the following conditions:

        The above copyright notice and this permission notice shall be included in all
        copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
        OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
        SOFTWARE.
    */

    /*

        Constructor FuzzySearch(
            options = {
                SCORE_WIDTH_BYTES: <unset>|<int(2|4)>,
                DATA_WIDTH_BYTES: <unset>|<int(2|4)>,
                FORCE_SINGLE_THREAD: <unset>|<boolean>
            }
        )
            Throws:
                - Instantiation Error


        Exports

        init(
            data:<array[<string>|<object{*:<string>}>,...]>
            keys:<unset>|<array[<string>,...]>
            copy:<unset(default="direct")>|"direct"|"ascii-words"|"ascii-code"
            fast:<unset(default="false")>|<boolean>
        ) : void
            
            Throws: 
                - Thread Lock Error
                - Type Error
            
            Note: data objects must have at least
                1 key-string pair. 
            Note: If keys[] is not specified, it 
                will be generated from data[0].
                All keys of data[0] pointing to
                strings will become keys. 
                All subsequent data[n] must 
                define strings on the same 
                keys[] found in data[0].

        async search( 
                target: <string>, 
                limit: <unset(default=10)> | <int> )
            : results = {
                "key": {
                    "perfect": [
                        { "score": <int>, "index": <int> },
                        { "score": <int>, "index": <int> },
                        ...
                    ],
                    "full": [ ... ],
                    "fuzzy": [ ... ]
                },
                "key2": {
                    "perfect": [ ... ],
                    "full": [ ... ],
                    "fuzzy": [ ... ]
                },
                ...
            }

            Throws
                - Thread Lock Error
                - Initialization Error

        getResults( limit: <unset(default=10)> | <int> )
            : results = {
                "key": {
                    "perfect": [
                        { "score": <int>, "index": <int> },
                        { "score": <int>, "index": <int> },
                        ...
                    ],
                    "full": [ ... ],
                    "fuzzy": [ ... ]
                },
                "key2": {
                    "perfect": [ ... ],
                    "full": [ ... ],
                    "fuzzy": [ ... ]
                },
                ...
            }

            Throws
                - Thread Lock Error
                - Initialization Error

        getScore( index: <int> )
            : score = {
                "key": {
                    "perfect": <int>,
                    "full": <int>,
                    "fuzzy": <int>
                },
                "key2": { ... }
            }

            Throws:
                - Thread Lock Error
                - Initialization Error
                - Out-of-Bounds Error

    */

    /*
    Structure of This Constructor
    
    FuzzySearch( options )
        - Options Checks
            - SCORE_WIDTH_BYTES
            - DATA_WIDTH_BYTES
            - FORCE_SINGLE_THREAD
        - Global Constants
            - arrayTypeByBytes
            - TABLE_HEADERS
            - HEADER_WIDTH_BYTES
            - HEADERS_SIZE_BYTES
            - SCORE_WIDTH_BYTES
            - SCORE_KINDS
            - PERFECT_MATCH
            - FULL_MATCH
            - FUZZY_MATCH
            - SCORES_PER_FIELD
            - DATA_WIDTH_BYTES
            - FORCE_SINGLE_THREAD
        - Global References
            - TABLES
            - BUFFER
            - KEYS
            - COPY
            - FAST
        - Global Flags
            - THREAD_LOCK
            - SEARCH_SCORES_COMPUTED
            - UNKEYED

        - initError()
        - Export: init( 
                data:array[string|object{*:string},...]
                keys:array[string,...]
                copy:
                    |unset(default="direct")
                    |"direct"
                    |"ascii-words"
                    |"ascii-code"
                fast:
                    |unset(default="false")
                    |boolean )
            : void
            - THREAD_LOCK check
            - fast check
                - copy check
                - fast check
                - data string check
                    - set unkeyed
                - data array check
                - no keys check
                    - generate keys
                - keys array check
                - for each keys[]:
                    - string check
                - for each data[]:
                    - string check
                    - object check
                        - for each keys[]:
                            - has check
                            - string check
            - if not fast
                - data string check
                    - set unkeyed
                - else build keys
            - save keys or null
            - save copy
            - save fast
            - copy data to buffer & create tables
            - save buffer & tables
            - invalidate searches on old data

        - Export: async search( 
                target: string
                limit: int(default=10) )
            : results | result
            - THREAD_LOCK check
            - if single thread
                - main-thread search 
                    (syncSearch(target))
                - return search results
            - if worker
                - await worker search
                    (asyncSearch(target))
                - return search results

        - Export: getResults( 
                limit: int )
            : results
            - THREAD_LOCK check
            - FAST check
                - init check
                - search check
            - setup results, minimums
            - get tables
            - search perfect, full, fuzzy:
                - ignore 0-score results
                - accumulate scored results
                    - up to limit
                - replace lowest-score result
                    - until results exausted
            - sort results by score
            - return results

        - Export: getScore( 
                index: int )
            : scores | score
            - THREAD_LOCK check
            - FAST check
                - init check
                - search check
            - get tables
            - index bounds check
            - look up perfect, full, fuzzy
            - return scores

        - syncSearch( 
                target: string )
            : void
            - FAST check
                - target string check
                - init check
            - main-thread search
                (computeSearchScores(target,TABLES))
            - set search completed flag = true

        - computeSearchScores( 
                target:string, 
                tables:tables )
            : void
            - unpack tables
            - create target table
            - for each data element
                - for each data field
                    - reset scores
                    - for each target code
                        - get code
                        - for each data code
                            - get code
                            - if match
                            - + fuzzy score
                            - declare target code matched
                            - shortcut: declare perfect 1 match
                            - for each remaining code
                                - get next codes
                                - if match
                                    - + fuzzy score (weighted)
                                    - if perfect match
                                        - + perfect score
                        - record target match
                    - if all targets matched
                        - full match score = 1
                    - advance to next score
                    - advance to next data

        - bufferDataToTables(
                data:array[string|object{*:string},...]
                keys:array[string,...]
                copy:
                    |unset(default="direct")
                    |"direct"
                    |"ascii-words"
                    |"ascii-code"
            )
            : { tables, buffer }
            - compute buffer size
            - create buffer
            - insert elementsCount, fieldsCount
            - create & unpack tables
                (createTableViewsFromBuffer)
            - for each element
                - for each field
                - store size
                | copy "direct"
                    - for each character in field
                        - copy field to dataTable
                            (charCodeAt())
                    - advance to next dataTable field
                | copy "ascii-words"
                    - track final size
                    - for each character in field
                        - get code
                            (charCodeAt())
                        - copy shift-case to dataTable
                        - copy alphanumeric to dataTable
                        - copy:collapse space to dataTable
                    - store final size
                | copy "ascii-code"
                    - track final size
                    - for each character in field
                        - get code
                        - test is space
                        - copy:collapse space to dataTable
                        - copy shift-case to dataTable
                        - copy any to dataTable
                    - store final size
                    - advance to next dataTable field
            - return { tables, buffer }

        - createTableViewsFromBuffer( buffer: ArrayBuffer )
            : tables 
                { headerTable, scoreTable, dataTable }
                (All Typed Arrays referencing buffer)
            - create headerTable
            - extract elementsCount, fieldsCount
            - create scoreTable, dataTable
                (getScoreTableView)
                (getDataTableView)
            - return tables
        - getHeaderTableView( 
                buffer: ArrayBuffer, 
                headerTableSizeElements: int )
            : table (Typed Array referencing buffer)
            - create table (Typed Array)
            - return table (Typed Array)
        - getScoreTableView(
                buffer: ArrayBuffer
                headerTableSizeBytes: int
                scoreTableSizeElements: int )
            : table (Typed Array referencing buffer)
            - create table (Typed Array)
            - return table (Typed Array)
        - getDataTableView(
                buffer: ArrayBuffer
                headerTableSizeBytes: int
                scoreTableSizeBytes: int )
            : table (Typed Array referencing buffer)
            - create table (Typed Array)
            - return table (Typed Array)

        - createTableFromTarget( 
                target: string, 
                copy: string )
            : table (Typed Array)
            - clean for "ascii-words"
            - clean for "ascii-code"
            - create table (Typed Array)
            - copy target to table
            - return table (Typed Array)

        ! asyncSearch defined only if:
            FORCE_SINGLE_THREAD === false
        - Define asyncSearch
            - worker = create worker()
                : worker
                - create worker source
                    - Global Constants
                    - computeSearchScores()
                    - createTableFromTarget()
                    - createTableViewsFromBuffer()
                    - getHeaderTableView()
                    - getScoreTableView()
                    - getDataTableView()
                - create source blob
                - create source URL
                - create worker
                - revoke source URL
                - return worker
            - define asyncSearch = ( target: string )
                : promise -> void
                - lock thread
                - return Promise
                    - listen worker message
                        - save buffer (transferred)
                        - create & save tables
                        - unlock thread
                        - declare search completed
                        - resolve void
                    - post worker message
                        - target, buffer (transferred)

        - return construct: exports
    */


    if( "SCORE_WIDTH_BYTES" in options ) {
        if( options.SCORE_WIDTH_BYTES !== 2 &&
            options.SCORE_WIDTH_BYTES !== 4 ) {
            console.error(
                "FuzzySearch( options ) options.SCORE_WIDTH_BYTES must be integer: 2 or 4."
            );
            throw "Instantiation Error";
        }
    }
    else options.SCORE_WIDTH_BYTES = 2;

    if( "DATA_WIDTH_BYTES" in options ) {
        if( options.DATA_WIDTH_BYTES !== 2 &&
            options.DATA_WIDTH_BYTES !== 4 ) {
            console.error(
                "FuzzySearch( options ) options.DATA_WIDTH_BYTES must be integer: 2 or 4."
            );
            throw "Instantiation Error";
        }
    }
    else options.DATA_WIDTH_BYTES = 2;

    if( "FORCE_SINGLE_THREAD" in options ) {
        if( options.FORCE_SINGLE_THREAD !== true &&
            options.FORCE_SINGLE_THREAD !== false ) {
            console.error(
                "FuzzySearch( options ) options.DATA_WIDTH_BYTES must be boolean: true or false."
            );
            throw "Instantiation Error";
        }
    }
    else options.FORCE_SINGLE_THREAD = false;

    if( "FUZZY_RESOLUTION" in options ) {
        if( typeof options.FUZZY_RESOLUTION !== "number" ) {
            console.error(
                "FuzzySearch( options ) options.FUZZY_RESOLUTION must be a number."
            );
            throw "Instantiation Error";
        }
        else if( parseInt( options.FUZZY_RESOLUTION ) !== options.FUZZY_RESOLUTION ) {
            console.error(
                "FuzzySearch( options ) options.DATA_WIDTH_BYTES must be an integer. It was: ",
                options.FUZZY_RESOLUTION
            );
            throw "Instantiation Error";
        }
        else if( options.FUZZY_RESOLUTION <= 0 ) {
            console.error(
                "FuzzySearch( options ) options.DATA_WIDTH_BYTES must be greater than 0. It was: ",
                options.FUZZY_RESOLUTION
            );
            throw "Instantiation Error";
        }
    }
    else options.FUZZY_RESOLUTION = 200;

    const exportables = {};

    //Global Constants
    /* 
    Note: Any changes to the *structure* of these 
        constants requires verification of 
        workerSource to ensure worker is still 
        receiving the correct constant definitions.
    Changes to the *values* of these constants
        must automatically propagate to
        workerSource.
     */
    const 
        //table views
        arrayTypeByBytes = {
            1: Uint8Array,
            2: Uint16Array,
            4: Uint32Array
        },
    
        //header structure
        TABLE_HEADERS = [
            "Elements Count",
            "Fields Count",
        ],
        HEADER_WIDTH_BYTES = 2,
        HEADERS_SIZE_BYTES =
            TABLE_HEADERS.length *
            HEADER_WIDTH_BYTES,
    
        //score structure
        SCORE_WIDTH_BYTES = 
            options.SCORE_WIDTH_BYTES,
        SCORE_KINDS = [
            "Perfect Match",
            "Full Match",
            "Fuzzy Match"
        ],
            PERFECT_MATCH = 0,
            FULL_MATCH = 1,
            FUZZY_MATCH = 2,
        SCORES_PER_FIELD = 
            SCORE_KINDS.length,
    
        //data structure
        DATA_WIDTH_BYTES = 
            options.DATA_WIDTH_BYTES,
        
        //threading
        FORCE_SINGLE_THREAD =
            options.FORCE_SINGLE_THREAD,

        //fuzzy algorithm
        FUZZY_RESOLUTION =
            options.FUZZY_RESOLUTION;

    //Global References
    let TABLES = null,
        BUFFER = null,
        KEYS = null,
        COPY = null,
        FAST = false;
    
    //Global Flags
    let THREAD_LOCK = false,
        SEARCH_SCORES_COMPUTED = false,
        UNKEYED = false;

    //Initialize Searchable Tables
    const initError = ( code, name ) =>
        `FuzzySearch.init( ` + 
            `data:<array[<string>|<object{*:<string>}>,...]>, ` + 
            `keys:<array[<string>,...]>, ` + 
            `copy:<unset>|"direct"|"ascii-words"|"ascii-code", ` + 
            `fast:<unset>|<boolean>, ` + 
        `) - type ${code} did not match ${name}`;
    //Export:
    function init( 
            data, //<array[ <string> | <object{*:<string>}>, ... ]>
            keys, //<unset> | <falsy> | <array[ <string>, ... ]>
            copy = "direct", //<unset> | "direct" | "ascii-words" | "ascii-code"
            fast = false //<unset> | <boolean>
        ) {

        if( THREAD_LOCK === true ) {
            console.error(
                `FuzzySearch.init() called while search in progress.\n`,
                `Call: await FuzzySearch.search( target ) or use multiple instances of FuzzySearch to avoid this block.`
            )
            throw "Thread Lock Error";
        }
        if( fast === false ) {
            //require copy to be "direct" or "words"
            if( copy !== "direct" &&
                copy !== "ascii-words" &&
                copy !== "ascii-code" ) {
                console.error(
                    initError(
                        `<unset>|"direct"|"ascii-words"|"ascii-code"`,
                        `"copy"`
                    ) + " because:\n",
                    `"copy" was: `, copy
                )
                throw "Type Error";
            }

            //require fast to be boolean
            if( fast !== true &&
                fast !== false ) {
                    console.error(
                        initError(
                            `<unset>|<boolean>`,
                            `"fast"`
                        ) + " because:\n",
                        `"fast" was: `, fast
                    )
                    throw "Type Error";
            }

            //require data to be an array
            if( Array.isArray( data ) === false ) {
                console.error(
                    initError( 
                        "<array>", 
                        `"data"` 
                    ) + " because:\n",
                    `"data" was type: <${typeof data}>`
                );
                throw "Type Error";
            }

            let generatedKeys = false;

            const object0 = data[ 0 ];
            if( typeof object0 === "string" ) {
                UNKEYED = true;
                keys = null;
            }
            else if( ! keys ) {
                keys = [];
                const object0 = data[ 0 ];
                if( typeof object0 === "object" &&
                    Array.isArray( object0 ) === false ) {
                    if( Array.isArray( object0 ) ) {
                        const typePrint = 
                            Array.isArray( object0 ) ?
                            "array" : ( typeof object0 );
                        console.error(
                            initError(
                                "<array[<object>,...]>",
                                `"data"`
                            ) + " because:\n",
                            `"data[ 0 ]" was type: <${typePrint}>`
                        )
                        throw "Type Error";
                    }
                    const objectKeys = Object.keys( object0 );
                    if( objectKeys.length === 0 ) {
                        console.error(
                            `"data[0]" had no keys.`
                        );
                        throw "Type Error"
                    }
                    for( let k of objectKeys ) {
                        if( typeof object0[ k ] === "string" )
                            keys.push( k );
                    }
                    if( keys.length === 0 ) {
                        console.error(
                            `The object at "data[0]" contained no searchable strings.`
                        );
                        throw "Type Error"
                    }
                    generatedKeys = true;
                }
                else {
                    const typePrint = 
                        Array.isArray( object0 ) ?
                        "array" : ( typeof object0 );
                    console.error(
                        initError(
                            "<array[<string>|<object>,...]>",
                            `"data"`
                        ) + " because:\n",
                        `"data[ 0 ]" was type: <${typePrint}>`
                    )
                    throw "Type Error";
                }
            }
            else {
                //require keys to be an array
                if( Array.isArray( keys ) === false ) {
                    console.error(
                        initError(
                                "<array>",
                                `"keys"`
                            ) + " because:\n",
                        `"keys" was type: <${typeof keys}>`
                    );
                    throw "Type Error";
                }
                //require every entry of keys to be a string
                for( let ki = 0; ki < keys.length; ki++ ) {
                    const k = keys[ ki ];
                    if( typeof k !== "string" ) {
                        const typeOfK =
                            Array.isArray( k ) ?
                            "array" :
                            ( typeof k );
                        console.error(
                            initError(
                                    "<array[<string>,...]>",
                                    `"keys"`
                                ) + " because:\n",
                            `"keys[ ${ki} ]" was type: <${typeOfK}>`
                        );
                        throw "Type Error";
                    }
                }	
            }

            for( let di = 0; di < data.length; di++ ) {
                const d = data[ di ];
                if( UNKEYED ) {
                    //require every unkeyed entry of data to be a string
                    if( typeof d !== "string" ) {
                        const typeOfD =
                            Array.isArray( d ) ?
                            "array" :
                            ( typeof d );
                        console.error(
                            initError(
                                    "<array[<string>,...]>",
                                    `"data"`
                                ) + " because:\n",
                            `"data[ ${di} ]" was type: <${typeOfD}>`
                        );
                        throw "Type Error";
                    }
                }
                else {
                    //require every entry of data to be an object
                    if( typeof d !== "object" ) {
                        const typeOfD =
                            Array.isArray( d ) ?
                            "array" :
                            ( typeof d );
                        console.error(
                            initError(
                                    "<array[<object>,...]>",
                                    `"data"`
                                ) + " because:\n",
                            `"data[ ${di} ]" was type: <${typeOfD}>`
                        );
                        throw "Type Error";
                    }
                    else {
                        for( let ki=0; ki<keys.length; ki++ ) {
                            const k = keys[ ki ];
                            //require every entry of data to define every key
                            if( ! k in d ) {
                                console.error(
                                    initError(
                                            "<array[<object{...[&keys]}>,...]>",
                                            `"data"`
                                        ) + " because:\n",
                                    `"data[ ${di} ]" was missing key "keys[ ${ki} ]": "${k}"`,
                                    generatedKeys ? `\n("keys[]" were inferred from "data[0]".)` : ""
                                );
                                throw "Type Error";
                            }
                            else {
                                const typeOfDK =
                                    Array.isArray( d[ k ] ) ?
                                    "array" :
                                    ( typeof d[ k ] );
                                //require every defined key to be a string
                                if( typeOfDK !== "string" ) {
                                    console.error(
                                        initError(
                                                "<array[<object{...[&keys]:<string>}>,...]>",
                                                `"data"`
                                            ) + " because:\n",
                                        `"data[ ${di} ][ "${k}" ]" was type <${typeOfDK}>`
                                    );
                                    throw "Type Error";
                                }
                            }
                        }
                    }
                }
            }
        }
        else {
            if( ! keys ) {
                const object0 = data[ 0 ];
                if( typeof object0 === "string" )
                    UNKEYED = true;
                else {
                    const objectKeys = Object.keys( object0 );
                    keys = [];
                    for( let k of objectKeys )
                        if( typeof object0[ k ] === "string" )
                            keys.push( k );
                }
            }
        }

        //store keys for later reference
        if( UNKEYED )
            KEYS = null;
        else {
            KEYS = [];
            for( let k of keys )
                KEYS.push( k );
        }
        
        //store copy for later reference
        COPY = copy;

        //store fast for later reference
        FAST = fast;

        //copy data to buffer & create tables
        const {
                tables,
                buffer
            } = bufferDataToTables( 
                data, 
                keys,
                copy
            );
        
        //save buffer & tables
        BUFFER = buffer;
        TABLES = tables;

        //invalidate any previous searches
        SEARCH_SCORES_COMPUTED = false;
    }
    exportables.init = init;
    
    //Export:
    async function search( target, limit = 10 ) {
        if( THREAD_LOCK === true ) {
            console.error(
                `FuzzySearch.search( target ) called while search in progress.\n`,
                `Call: await FuzzySearch.search( target ) to avoid this block.`
            )
            throw "Thread Lock Error";
        }
        if( FORCE_SINGLE_THREAD === true ) {
            syncSearch( target );
            return getResults( limit );
        }
        else {
            await asyncSearch( target );
            return getResults( limit );
        }
    }
    exportables.search = search;

    
    //Fetch results, up to "limit" per field per score type.
    //Export:
    function getResults(
        limit //int
    ) {
        if( THREAD_LOCK === true ) {
            console.error(
                `FuzzySearch.getResults( limit ) called while search in progress.\n`,
                `Call: await FuzzySearch.search( target ) to avoid this block.`
            )
            throw "Thread Lock Error";
        }
        if( FAST === false ) {
            if( TABLES === null ) {
                console.error(
                    "FuzzySearch.getResults( limit ) called before initializing search tables.\n" +
                    `Call FuzzySearch.init( keys, data ). Then call FuzzySearch.search( target ). Then call FuzzySearch.getScore( index ) or FuzzySearch.getResults( limit ).`
                );
                throw "Initialization Error";
            }
            else if( SEARCH_SCORES_COMPUTED === false ) {
                console.error(
                    `FuzzySearch.getResults( limit ) called before performing a search.\n` +
                    `Call FuzzySearch.search( target ). Then call FuzzySearch.getScore( index ) or FuzzySearch.getResults( limit ).`
                );
                throw "Initialization Error";
            }
        }
        const results = {},
            minimums = {};
        if( UNKEYED ) {
            results.perfect = [];
            results.full = [];
            results.fuzzy = [];
            
            minimums.perfect = {
                    score: Infinity,
                    resultIndex: -1,
                    elementIndex: -1,
                };
            minimums.full = {
                    score: Infinity,
                    resultIndex: -1,
                    elementIndex: -1,
                };
            minimums.fuzzy = {
                    score: Infinity,
                    resultIndex: -1,
                    elementIndex: -1,
                };
        }
        else for( let key of KEYS ) {
            results[ key ] = {
                perfect: [],
                full: [],
                fuzzy: [],
            };
            minimums[ key ] = {
                perfect: {
                    score: Infinity,
                    resultIndex: -1,
                    elementIndex: -1,
                },
                full: {
                    score: Infinity,
                    resultIndex: -1,
                    elementIndex: -1,
                },
                fuzzy: {
                    score: Infinity,
                    resultIndex: -1,
                    elementIndex: -1,
                },
            }
        }

        const { 
            headerTable,
            scoreTable
        } = TABLES,
        [
            elementsCount,
            fieldsCount
        ] = headerTable;

        let SI = 0; //score pointer

        for( let ei = 0; ei < elementsCount; ei++ ) {
            for( let fi = 0; fi < fieldsCount; fi++ ) {
                const key = UNKEYED ? null : KEYS[ fi ],
                    result = UNKEYED ? 
                        results : results[ key ],
                    minimum = UNKEYED ? 
                        minimums : minimums[ key ],
                    perfectScore = 
                        scoreTable[ 
                            SI + PERFECT_MATCH 
                        ],
                    fullScore = 
                        scoreTable[ 
                            SI + FULL_MATCH 
                        ],
                    fuzzyScore = 
                        scoreTable[ 
                            SI + FUZZY_MATCH 
                        ];
                
                if( perfectScore > 0 ) {
                    if( result.perfect.length < limit ) {
                        result.perfect.push( {
                            score: perfectScore,
                            index: ei
                        } )
    
                        if( perfectScore < 
                                minimum.perfect.score ) {
                            minimum.perfect.score = 
                                perfectScore;
                            minimum.perfect.resultIndex = 
                                result.perfect.length - 1;
                            minimum.perfect.elementIndex =
                                ei;
                        }
                    }
                    else if( perfectScore < 
                        minimum.perfect.score ) {
                        const overwriteIndex =
                            minimum.perfect.resultIndex;
                        result.perfect[
                                overwriteIndex
                            ].score = perfectScore;
                        result.perfect[
                                overwriteIndex
                            ].index = ei;
    
                        minimum.perfect.score = 
                            perfectScore;
                        minimum.perfect.resultIndex = 
                            overwriteIndex;
                        minimum.perfect.elementIndex =
                            ei;
                    }
                }
                
                if( fullScore > 0 ) {
                    if( result.full.length < limit ) {
                        result.full.push( {
                            score: fullScore,
                            index: ei
                        } )
    
                        if( fullScore < 
                                minimum.full.score ) {
                            minimum.full.score = 
                                fullScore;
                            minimum.full.resultIndex = 
                                result.full.length - 1;
                            minimum.full.elementIndex =
                                ei;
                        }
                    }
                    else if( fullScore < 
                        minimum.full.score ) {
                        const overwriteIndex =
                            minimum.full.resultIndex;
                        result.full[
                                overwriteIndex
                            ].score = fullScore;
                        result.full[
                                overwriteIndex
                            ].index = ei;
    
                        minimum.full.score = 
                            fullScore;
                        minimum.full.resultIndex = 
                            overwriteIndex;
                        minimum.full.elementIndex =
                            ei;
                    }
                }
                
                if( fuzzyScore > 0 ) {
                    if( result.fuzzy.length < limit ) {
                        result.fuzzy.push( {
                            score: fuzzyScore,
                            index: ei
                        } )
    
                        if( fuzzyScore < 
                                minimum.fuzzy.score ) {
                            minimum.fuzzy.score = 
                                fuzzyScore;
                            minimum.fuzzy.resultIndex = 
                                result.fuzzy.length - 1;
                            minimum.fuzzy.elementIndex =
                                ei;
                        }
                    }
                    else if( fuzzyScore < 
                        minimum.fuzzy.score ) {
                        const overwriteIndex =
                            minimum.fuzzy.resultIndex;
                        result.fuzzy[
                                overwriteIndex
                            ].score = fuzzyScore;
                        result.fuzzy[
                                overwriteIndex
                            ].index = ei;
    
                        minimum.fuzzy.score = 
                            fuzzyScore;
                        minimum.fuzzy.resultIndex = 
                            overwriteIndex;
                        minimum.fuzzy.elementIndex =
                            ei;
                    }
                }

                //advance score pointer
                SI += SCORES_PER_FIELD;
            }
        }

        //sort results by score
        const sort = ( a, b ) => {
            if( b.score !== a.score )
                return b.score - a.score;
            else return a.index - b.index;
        };

        if( UNKEYED ) {
            results.perfect.sort( sort );
            results.full.sort( sort );
            results.fuzzy.sort( sort );
        }
        else for( let key of KEYS ) {
            const result = results[ key ];

            result.perfect.sort( sort );
            result.full.sort( sort );
            result.fuzzy.sort( sort );
        }

        return results;
    }
    exportables.getResults = getResults;
     
    //Fetch Scores by Data Index
    //Export:
    function getScore( 
        index //int
    ) {
        if( THREAD_LOCK === true ) {
            console.error(
                `FuzzySearch.getScore( index ) called while search in progress.\n`,
                `Call: await FuzzySearch.search( target ) to avoid this block.`
            )
            throw "Thread Lock Error";
        }
        if( FAST === false ) {
            if( TABLES === null ) {
                console.error(
                    "FuzzySearch.getScore( index ) called before initializing search tables.\n" +
                    `Call FuzzySearch.init( keys, data ). Then call FuzzySearch.search( target ). Then call FuzzySearch.getScore( index ) or FuzzySearch.getResults( limit ).`
                );
                throw "Initialization Error";
            }
            else if( SEARCH_SCORES_COMPUTED === false ) {
                console.error(
                    `FuzzySearch.getScore( index ) called before performing a search.\n` +
                    `Call FuzzySearch.search( target ). Then call FuzzySearch.getScore( index ) or FuzzySearch.getResults( limit ).`
                );
                throw "Initialization Error";
            }
        }

        const { 
                headerTable,
                scoreTable
            } = TABLES,
            [
                elementsCount,
                fieldsCount
            ] = headerTable;

        let scoreIndex =
                fieldsCount *
                SCORES_PER_FIELD *
                index;

        if( index > elementsCount ) {
            console.error(
                `FuzzySearch.getScore( index ) called with index: ${index}, but data was initialized with only ${elementsCount} searchable elements.`
            );
            throw "Out-of-Bounds Error";
        }
        else {
            const keys = KEYS || [ "dummy-key" ];
            let scores = {};
            for( let ki=0; ki<keys.length; ki++ ) {
                const k = keys[ ki ],
                    score = {
                        perfect: scoreTable[ 
                            scoreIndex + 
                            PERFECT_MATCH
                        ],
                        full: scoreTable[
                                scoreIndex +
                                FULL_MATCH
                            ],
                        fuzzy: scoreTable[
                            scoreIndex +
                            FUZZY_MATCH
                        ]
                    };

                scores[ k ] = score;

                //advance score pointer
                scoreIndex += 
                    SCORES_PER_FIELD;
            }

            return UNKEYED ?
                scores[ "dummy-key" ] :
                scores;
        }
    }
    exportables.getScore = getScore;

    function syncSearch(
            target //string
        ) {
        if( FAST === false ) {
            if( typeof target !== "string" ) {
                console.error( 
                    `FuzzySearch.search( target:<string> ) - type <string> did not match target: `,
                    target
                );
                throw "Type Error";
            }
            else if( TABLES === null ) {
                console.error(
                    `FuzzySearch.search( target ) called before initializing search tables.\n` +
                    `Call FuzzySearch.init( keys, data ) before calling FuzzySearch.search( target ).`
                );
                throw "Initialization Error";
            }
        }
        computeSearchScores(
            target,
            TABLES
        );
        SEARCH_SCORES_COMPUTED = true;
    }
    
    //(Included in Worker Source)
    function computeSearchScores( 
            target, // string
            tables // tables
        ) {
        const {
                headerTable,
                scoreTable,
                dataTable
            } = tables,
            [
                elementsCount,
                fieldsCount
            ] = headerTable,
    
            targetLength = 
                target.length,
            
            targetTable =
                createTableFromTarget(
                    target,
                    COPY
                );
    
        let IS = 0, //score pointer
            ID = 0; //data pointer

        for( let ei = 0; ei < elementsCount; ei++ ) {
            for( let fi = 0; fi < fieldsCount; fi++ ) {
                //get data length
                const entrySizeElements = dataTable[ ID ];
                //advance data pointer
                ++ID;
    
                //reset score records
                scoreTable[ IS + PERFECT_MATCH ] = 0;
                scoreTable[ IS + FULL_MATCH ] = 0;
                scoreTable[ IS + FUZZY_MATCH ] = 0;
    
                //each matched target code counts once
                //	if counter === target.length, it's a full match
                let fullMatchCounter = 0;
    
                //Search Loop:
    
                //loop through the target codes
                for( let i = 0; i < targetLength; i++ ) {
                    //get the current targetCode
                    const targetCode = targetTable[ i ];

                    //track whether this target code matches at all
                    let matchedCode = 0;
    
                    //loop through the data entry codes
                    for( let d = 0; d < entrySizeElements; d++ ) {
                        //get the current data code
                        const dataCode = dataTable[ ID + d ];
    
                        //initial match:
                        if( targetCode === dataCode ) {
                            //increment fuzzy match score
                            /* Divide by length:
                                Longer strings are more likely
                                to match single characters randomly.
                            */
                            scoreTable[ IS + FUZZY_MATCH ] += 
                                Math.max( 1,
                                    parseInt(
                                        FUZZY_RESOLUTION / 
                                        entrySizeElements
                                    )
                                );
    
                            //register target code toward full match
                            matchedCode = 1;
    
                            //register 1-term perfect match
                            if( targetLength === 1 )
                                ++scoreTable[ IS + PERFECT_MATCH ];

                            //follow the stream to see if we have
                            //	consecutive matches:
                            const J = targetLength - i;
                            for( let j = 1; j < J && ( d + j ) < entrySizeElements; j++ ) {
                                const nextTargetCode = 
                                        targetTable[ j ],
                                    nextDataCode = 
                                        dataTable[ ID + d + j ];
                                
                                if( nextTargetCode === nextDataCode ) {
                                    //increment fuzzy match score
                                    /* Length weight:
                                        The more characters in a row we
                                        match, the less we care about
                                        how long our string is.
                                    */
                                    const lengthWeight = parseInt(
                                            FUZZY_RESOLUTION / 
                                            Math.max( 1, 
                                                ( entrySizeElements / j )
                                            )
                                        );
                                    scoreTable[ IS + FUZZY_MATCH ] +=
                                        lengthWeight;
    
                                    if( i === 0 &&
                                        j === J - 1 ) {
                                        //increment record of perfect matches
                                        ++scoreTable[ IS + PERFECT_MATCH ];
                                    }
                                }
    
                                else break;
                            }
                        }
                    }

                    if( matchedCode === 1 )
                        //increment full match counter
                        ++fullMatchCounter
                }
    
                //scale fuzzy score
                /* Scale by length of target to
                    keep sizes manageable and
                    consistent across varied-length
                    searches.
                */
                let scaledScore = parseInt(
                    scoreTable[ IS + FUZZY_MATCH ] /
                        targetLength
                    );
                scoreTable[ IS + FUZZY_MATCH ] = 
                    scaledScore;

                //record full match
                if( fullMatchCounter === targetLength ) {
                    scoreTable[ IS + FULL_MATCH ] = 1;
                }
    
                //advance score pointer
                IS += SCORES_PER_FIELD;
                //advance data pointer
                ID += entrySizeElements;
            }
        }
    }

    /*
        data - array of strings or objects, 
            if objects:
            each having all keys listed in keys,
            each key points to string.
            charCodeAt() will be used to copy
                string to data table
        keys - array of strings
        copy - "direct" or "ascii-words" or "ascii-code"
            (collapse white-space or non-alpha-numeric 
                into 1 white-space 0x20)
    */
    function bufferDataToTables( 
            data, 
            keys, 
            copy
        ) {

        if( ! keys ) keys = [ "dummy-key" ];

        const headerTableSizeElements =
                TABLE_HEADERS.length,
            headerTableSizeBytes =
                HEADERS_SIZE_BYTES,

            elementsCount = data.length,
            fieldsCount = keys.length,

            scoresCount = 
                elementsCount *
                fieldsCount,
            scoreTableSizeElements =
                scoresCount *
                SCORES_PER_FIELD,
            scoreTableSizeBytes = 
                scoreTableSizeElements *
                SCORE_WIDTH_BYTES,

            entryLengthSizeElements = 1,
            entryLengthSizeBytes =
                entryLengthSizeElements *
                DATA_WIDTH_BYTES;

        
        let dataTableSizeBytes = 0;
        for( let element of data )
            for( let key of keys ) {
                const entry = UNKEYED ?
                        element :
                        element[ key ],
                    entrySizeCharacters =
                        entry.length,
                    entrySizeBytes =
                        entrySizeCharacters *
                        DATA_WIDTH_BYTES;

                dataTableSizeBytes +=
                    entrySizeBytes +
                    entryLengthSizeBytes;
            }
        
        const tableSize =
                headerTableSizeBytes +
                scoreTableSizeBytes +
                dataTableSizeBytes,
            buffer = new ArrayBuffer( tableSize ),
            TempViewConstructor =
                arrayTypeByBytes[
                    HEADER_WIDTH_BYTES
                ],
            tempHeaderView = new TempViewConstructor( buffer, 0, 2 );

        //Copy Headers to Buffer

        tempHeaderView[ 0 ] = elementsCount;
        tempHeaderView[ 1 ] = fieldsCount;

        //Open Table Views

        const tables = createTableViewsFromBuffer( buffer ),
            {
                headerTable,
                scoreTable,
                dataTable
            } = tables;

        //Scores Uninitialized in Table
    
        //Copy Data to Table
        //dataTable pointer for recording data
        let I = 0;
        for( let element of data ) {
            //Record an element's entries
            for( let key of keys ) {
                //Record an entry
    
                //Structure enforced on init()
                //	No checks here.

                const entry = UNKEYED ?
                        element :
                        element[ key ],
                    entrySizeElements =
                        entry.length;
                
                //record entry length
                dataTable[ I ] = entrySizeElements;
                //advance data pointer
                I += entryLengthSizeElements;
    
                //record entry
                if( copy === "direct" ) {
                    for( let i=0; 
                        i<entry.length; 
                        i++ )
                        dataTable[ I + i ] =
                            entry.charCodeAt( i );

                    //advance data pointer
                    I += entrySizeElements;
                }
                else if( copy === "ascii-words" ) {
                    //copy only letters, in lower case
                    let copyEntrySizeElements = 0;
    
                    //track in-copy-process of valid characters
                    let inValid = true;

                    for( let i=0; i<entry.length; i++ ) {
                        const code = entry.charCodeAt( i );

                        //shift to lower-case
                        if( code >= 65 && code <= 90) {
                            dataTable[ I + i ] = code + 32;
                            inValid = true;
                            ++copyEntrySizeElements;
                        }
                        //record ascii letters & numbers only
                        else if( ( code >= 97 && code <= 122 ) ||
                            ( code >= 48 && code <= 57 ) ) {
                            dataTable[ I + i ] = code;
                            inValid = true;
                            ++copyEntrySizeElements;
                        }
                        //collapse all else into 1 space (0x20)
                        else if( inValid === true ) {
                            dataTable[ I + i ] = 0x20;
                            inValid = false;
                            ++copyEntrySizeElements;
                        }
                        else if( inValid === false )
                            continue;
                    }

                    //record corrected entry length
                    dataTable[ I - 1 ] = copyEntrySizeElements;

                    //advance data pointer
                    I += copyEntrySizeElements;
                }
                else if( copy === "ascii-code" ) {
                    //collapse all spaces into 1 space (0x20)
                    let copyEntrySizeElements = 0;
    
                    //track in-copy-process of valid characters
                    let inValid = true;

                    for( let i=0; i<entry.length; i++ ) {
                        const code = entry.charCodeAt( i ),
                            isSpace = 
                                ( code === 0x20 ||
                                ( code >= 0x9 && 
                                    code <= 0xd ) );

                        //collapse whitespace into 1 space (0x20)
                        if( inValid === true && 
                            isSpace === true ) {
                            dataTable[ I + i ] = 0x20;
                            inValid = false;
                            ++copyEntrySizeElements;
                        }
                        //shift to lowercase
                        else if( code >= 65 && code <= 90 ) {
                            dataTable[ I + i ] = code + 32;
                            inValid = true;
                            ++copyEntrySizeElements;
                        }
                        //record all else
                        else if( isSpace === false ) {
                            dataTable[ I + i ] = code;
                            inValid = true;
                            ++copyEntrySizeElements;
                        }
                        else if( inValid === false )
                            continue;
                    }

                    //record corrected entry length
                    dataTable[ I - 1 ] = copyEntrySizeElements;

                    //advance data pointer
                    I += copyEntrySizeElements;
                }
            }
        }

        return {
            tables,
            buffer
        }
    }

    //(Included in Worker Source)
    function createTableViewsFromBuffer( buffer ) {
        const headerTableSizeElements =
                TABLE_HEADERS.length,
            headerTableSizeBytes =
                HEADERS_SIZE_BYTES;

        const headerTable = getHeaderTableView(
                    buffer, 
                    headerTableSizeElements
                ),
            [
                elementsCount,
                fieldsCount
            ] = headerTable;

        const scoresCount = 
                elementsCount *
                fieldsCount,
            scoreTableSizeElements =
                scoresCount *
                SCORES_PER_FIELD,
            scoreTableSizeBytes = 
                scoreTableSizeElements *
                SCORE_WIDTH_BYTES;

        const scoreTable = getScoreTableView( 
                buffer, 
                headerTableSizeBytes, 
                scoreTableSizeElements 
            ),
            dataTable = getDataTableView(
                buffer, 
                headerTableSizeBytes,
                scoreTableSizeBytes 
            );

        return {
            headerTable,
            scoreTable,
            dataTable
        }
    }

    //(Included in Worker Source)
    function getHeaderTableView(
            buffer, // ArrayBuffer
            headerTableSizeElements //int
        ) {
        const tableOffset = 0,
            tableLength =
                headerTableSizeElements,
            ViewConstructor =
                arrayTypeByBytes[
                    HEADER_WIDTH_BYTES
                ],
            arrayView =
                new ViewConstructor(
                    buffer,
                    tableOffset,
                    tableLength
                );
    
        return arrayView;
    }
    
    //(Included in Worker Source)
    function getScoreTableView( 
            buffer, // ArrayBuffer
            headerTableSizeBytes, //int
            scoreTableSizeElements  // int
        ) {
        const tableOffset = 
                headerTableSizeBytes,
            tableLength = 
                scoreTableSizeElements,
            ViewConstructor = 
                arrayTypeByBytes[
                    SCORE_WIDTH_BYTES
                ],
            arrayView = 
                new ViewConstructor( 
                    buffer, 
                    tableOffset, 
                    tableLength 
                );
                
        return arrayView;
    }

    //(Included in Worker Source)
    function getDataTableView( 
            buffer, // ArrayBuffer
            headerTableSizeBytes,
            scoreTableSizeBytes // int
        ) {
        const tableOffset = 
                headerTableSizeBytes +
                scoreTableSizeBytes,
            ViewConstructor = 
                arrayTypeByBytes[
                    DATA_WIDTH_BYTES
                ],
            arrayView = 
                new ViewConstructor( 
                    buffer, 
                    tableOffset
                );
    
        return arrayView;
    }
    
    //(Included in Worker Source)
    function createTableFromTarget(
        target, //string
        copy, //string
    ) {

    if( copy === "ascii-words" ) {
        target = target.
            replace( /[^\w\d\s]/gm, " " ).
            replace( /[\s\r\n\t\v\f]+/gm, " " ).
            toLowerCase();
    }
    else if( copy === "ascii-code" ) {
        target = target.
            replace( /[\s\r\n\t\v\f]+/gm, " " ).
            toLowerCase();
    }

    const tableSizeElements = 
            target.length,
        TableConstructor =
            arrayTypeByBytes[
                DATA_WIDTH_BYTES
            ],
        table =
            new TableConstructor(
                tableSizeElements
            );

    for( let i = 0; 
        i < tableSizeElements; 
        i ++ )
        table[ i ] = 
            target.charCodeAt( i );
    
    return table;
}

    
    let asyncSearch = null;
    if( FORCE_SINGLE_THREAD === false ) {
        const worker = ( () => {
            const workerSource = 
                `const 
                //table views
                arrayTypeByBytes = {
                    1: Uint8Array,
                    2: Uint16Array,
                    4: Uint32Array
                },
            
                //header structure
                TABLE_HEADERS = ${JSON.stringify( TABLE_HEADERS )},
                HEADER_WIDTH_BYTES = ${HEADER_WIDTH_BYTES},
                HEADERS_SIZE_BYTES =
                    TABLE_HEADERS.length *
                    HEADER_WIDTH_BYTES,
            
                //score structure
                SCORE_WIDTH_BYTES = 
                    ${SCORE_WIDTH_BYTES},
                SCORE_KINDS = ${JSON.stringify( SCORE_KINDS )},
                    PERFECT_MATCH = ${PERFECT_MATCH},
                    FULL_MATCH = ${FULL_MATCH},
                    FUZZY_MATCH = ${FUZZY_MATCH},
                SCORES_PER_FIELD = 
                    SCORE_KINDS.length,
            
                //data structure
                DATA_WIDTH_BYTES = ${DATA_WIDTH_BYTES},

                //fuzzy algorithm
                FUZZY_RESOLUTION = ${FUZZY_RESOLUTION};
                
                let COPY = null;
        
                onmessage = message => {
                    COPY = message.data.copy;
                    const {
                            target,
                            buffer
                        } = message.data,
                        tables = 
                            createTableViewsFromBuffer( buffer );
                    
                    computeSearchScores(
                        target,
                        tables
                    );
        
                    self.postMessage(
                        { buffer },
                        [ buffer ]
                    )
                }
        
                const computeSearchScores =
                ${computeSearchScores.toLocaleString()}
        
                const createTableViewsFromBuffer =
                ${createTableViewsFromBuffer.toLocaleString()}
        
                const getHeaderTableView =
                ${getHeaderTableView.toLocaleString()}
        
                const getScoreTableView =
                ${getScoreTableView.toLocaleString()}
        
                const getDataTableView =
                ${getDataTableView.toLocaleString()}

                const createTableFromTarget =
                ${createTableFromTarget.toLocaleString()}
                `,
            sourceFile = new Blob(
                [ workerSource ],
                { type: "text/javascript" }
            ),
            sourceURL = 
                URL.createObjectURL(
                    sourceFile
                ),
            worker = new Worker(
                    sourceURL
                );
            
            URL.revokeObjectURL( sourceURL );

            return worker;
        } )();
        
        asyncSearch = function( target ) {
            THREAD_LOCK = true;
            return new Promise(
                finish => {
                    worker.onmessage =
                        message => {
                            BUFFER = message.data.buffer;
                            TABLES = createTableViewsFromBuffer(
                                BUFFER
                            );
                            THREAD_LOCK = false;
                            SEARCH_SCORES_COMPUTED = true;
                            finish();
                        }
                    worker.postMessage(
                        {
                            target,
                            buffer: BUFFER
                        },
                        [ BUFFER ]
                    )
                }
            )
        }
    }
    

    return exportables;
}