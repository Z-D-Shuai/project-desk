Function Q(s)
 Q = Chr(34) & Replace(s, Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
If WScript.Arguments.Count <> 3 Then WScript.Quit 2
Set shell = CreateObject("WScript.Shell")
WScript.Quit shell.Run(Q(WScript.Arguments(0)) & " " & Q(WScript.Arguments(1)) & " --data " & Q(WScript.Arguments(2)), 0, True)
