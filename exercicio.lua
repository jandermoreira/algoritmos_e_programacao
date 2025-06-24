-- exercicio.lua
local debug = quarto.log.output


local function strip_yaml(s)
    return s:gsub("^%-%-%-.-%-%-%-\n?", "", 1)
end


local function file_exists(path)
    local file = io.open(path, "r")
    local exists
    if file == nil then
        exists = false
    else
        exists = true
        file:close()
    end

    return exists
end


local function get_meta(meta)
    local identifier
    local title
    if meta["title"] then
        title = pandoc.utils.stringify(meta["title"])
    else
        title = ""
    end
    if meta["identifier"] then
        identifier = pandoc.utils.stringify(meta["identifier"])
    else
        identifier = "#????"
    end
    return { title = title, identifier = identifier }
end


local function exercise_filter(title, identifier)
    local function run_exercise_filter(div)
        if div.attr.classes:includes("exercicio") then
            local prefixo = ""
            local sufixo = ""
            local link_exercicio
            if title == "" then
                link_exercicio = pandoc.Str("#" .. identifier)
            else
                prefixo = "problemas/"
                sufixo = " #" .. identifier
                link_exercicio = pandoc.Link(
                    "#" .. identifier,
                    prefixo .. identifier .. ".html"
                )
            end

            local blocos_extra = {}

            if file_exists(prefixo .. identifier .. "c.qmd") then
                table.insert(
                    blocos_extra,
                    pandoc.Para({
                        pandoc.Link(
                            pandoc.Inlines { pandoc.Str("Comentário" .. sufixo) },
                            prefixo .. identifier .. "c.html"
                        )
                    })
                )
            end

            if file_exists(prefixo .. identifier .. "r.qmd") then
                table.insert(
                    blocos_extra,
                    pandoc.Para({
                        pandoc.Link(
                            pandoc.Inlines { pandoc.Str("Solução" .. sufixo) },
                            prefixo .. identifier .. "r.html"
                        )
                    })
                )
            end

            local header = pandoc.Div(
                pandoc.Header(
                    1,
                    pandoc.Inlines({
                        pandoc.Str(title .. " ["),
                        link_exercicio,
                        pandoc.Str("]")
                    }),
                    pandoc.Attr("", { "h4" })
                )
            )

            return {
                header,
                div,
                table.unpack(blocos_extra)
            }
        else
            return div
        end
    end

    return { Div = run_exercise_filter }
end


local function include_filter()
    function run_include_filter(block)
        if block.classes:includes("include") and block.attributes.file then
            local f = io.open(block.attributes.file, "r")
            if not f then
                io.stderr:write("include_noyaml.lua: não consegui abrir ", block.attributes.file, "\n")
                return {}
            end
            local content = f:read("*all")
            f:close()

            local doc = pandoc.read(content, "markdown")
            local meta = get_meta(doc.meta)

            content = strip_yaml(content)
            doc = pandoc.read(content, "markdown")
            doc = doc:walk(exercise_filter(meta.title, meta.identifier))

            return doc.blocks
        else
            return block
        end
    end

    return { CodeBlock = run_include_filter }
end


local function doc_filter(doc)
    local meta = get_meta(doc.meta)
    doc = doc:walk(include_filter())
    if meta.identifier ~= "#????" then
        debug(">>>>>>>>> YEs")
        doc = doc:walk(exercise_filter("", meta.identifier))
    end
    return doc
end



return {
    { Pandoc = doc_filter }
}
